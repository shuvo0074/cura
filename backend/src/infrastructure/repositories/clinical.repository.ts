import { Injectable } from '@nestjs/common';
import type { DocumentCategory } from '@cura/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CursorQuery, Page } from '../../core/ports/repositories';
import type {
  ClinicalNoteData,
  ClinicalRepository,
  EncounterDetail,
  PrescriptionData,
  VitalsData,
} from '../../core/ports/clinical.ports';

/**
 * Prisma adapter for the clinical record.
 *
 * The timeline is the hot read: one query loads an encounter page with vitals,
 * notes, prescription items and documents joined, rather than issuing a query
 * per section per row. A year of history at 20 entries per page is one round
 * trip, not eighty.
 */
@Injectable()
export class PrismaClinicalRepository implements ClinicalRepository {
  private static readonly INCLUDE = {
    doctor: { select: { fullName: true } },
    vitals: true,
    clinicalNote: true,
    prescription: { include: { items: { orderBy: { position: 'asc' } } } },
    documents: {
      where: { deletedAt: null },
      select: {
        id: true,
        category: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        storageKey: true,
        capturedOn: true,
        createdAt: true,
      },
    },
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  async findEncounter(id: string): Promise<EncounterDetail | null> {
    const row = await this.prisma.encounter.findUnique({
      where: { id },
      include: PrismaClinicalRepository.INCLUDE as never,
    });
    return row ? this.toDetail(row) : null;
  }

  async openEncounter(input: {
    patientId: string;
    doctorId: string;
    appointmentId: string | null;
    occurredAt: Date;
  }): Promise<EncounterDetail> {
    // One encounter per appointment. Reopening the prescription form must not
    // create a second record for the same visit.
    if (input.appointmentId) {
      const existing = await this.prisma.encounter.findUnique({
        where: { appointmentId: input.appointmentId },
        include: PrismaClinicalRepository.INCLUDE as never,
      });
      if (existing) return this.toDetail(existing);
    }

    const created = await this.prisma.encounter.create({
      data: {
        patientId: input.patientId,
        doctorId: input.doctorId,
        appointmentId: input.appointmentId,
        occurredAt: input.occurredAt,
      },
      include: PrismaClinicalRepository.INCLUDE as never,
    });
    return this.toDetail(created);
  }

  async timeline(input: {
    patientId: string;
    notBefore: Date | null;
    query: CursorQuery;
  }): Promise<Page<EncounterDetail>> {
    const rows = await this.prisma.encounter.findMany({
      where: {
        patientId: input.patientId,
        ...(input.notBefore ? { occurredAt: { gte: input.notBefore } } : {}),
      },
      include: PrismaClinicalRepository.INCLUDE as never,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: input.query.limit + 1,
      ...(input.query.cursor ? { cursor: { id: input.query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > input.query.limit;
    const page = hasMore ? rows.slice(0, input.query.limit) : rows;

    return {
      items: page.map((r) => this.toDetail(r)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async hasRecordsBefore(patientId: string, before: Date): Promise<boolean> {
    const count = await this.prisma.encounter.count({
      where: { patientId, occurredAt: { lt: before } },
      take: 1,
    });
    return count > 0;
  }

  async upsertVitals(encounterId: string, data: VitalsData): Promise<void> {
    await this.prisma.vitals.upsert({
      where: { encounterId },
      create: { encounterId, ...this.vitalsData(data) },
      update: this.vitalsData(data),
    });
  }

  async upsertClinicalNote(encounterId: string, data: ClinicalNoteData): Promise<void> {
    await this.prisma.clinicalNote.upsert({
      where: { encounterId },
      create: { encounterId, ...data },
      update: data,
    });
  }

  async upsertPrescription(encounterId: string, data: PrescriptionData): Promise<void> {
    // Items are replaced wholesale inside a transaction: a partial write would
    // leave a prescription that reads as valid but is missing a drug.
    await this.prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.upsert({
        where: { encounterId },
        create: {
          encounterId,
          investigations: data.investigations,
          followUpDate: data.followUpDate,
        },
        update: {
          investigations: data.investigations,
          followUpDate: data.followUpDate,
        },
      });

      await tx.prescriptionItem.deleteMany({ where: { prescriptionId: prescription.id } });
      await tx.prescriptionItem.createMany({
        data: data.items.map((item, position) => ({
          prescriptionId: prescription.id,
          position,
          drugName: item.drugName,
          strength: item.strength,
          form: item.form,
          durationDays: item.durationDays,
          morning: item.morning,
          noon: item.noon,
          night: item.night,
          mealRelation: item.mealRelation,
          instruction: item.instruction,
        })),
      });
    });
  }

  async sign(encounterId: string, at: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.encounter.update({ where: { id: encounterId }, data: { signedAt: at } }),
      this.prisma.prescription.updateMany({ where: { encounterId }, data: { signedAt: at } }),
    ]);
  }

  async isSigned(encounterId: string): Promise<boolean> {
    const row = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { signedAt: true },
    });
    return row?.signedAt !== null && row?.signedAt !== undefined;
  }

  // -------------------------------------------------------------------------

  private vitalsData(data: VitalsData) {
    return {
      weightKg: data.weightKg,
      systolic: data.systolic,
      diastolic: data.diastolic,
      pulseBpm: data.pulseBpm,
      temperatureC: data.temperatureC,
      respiratoryRate: data.respiratoryRate,
    };
  }

  /** Decimal columns arrive as Prisma Decimal; normalise to plain numbers. */
  private num(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    return typeof value === 'number' ? value : Number(value.toString());
  }

  private toDetail(row: Record<string, any>): EncounterDetail {
    return {
      id: row.id,
      patientId: row.patientId,
      doctorId: row.doctorId,
      doctorName: row.doctor?.fullName ?? '',
      appointmentId: row.appointmentId ?? null,
      occurredAt: row.occurredAt,
      signedAt: row.signedAt ?? null,
      vitals: row.vitals
        ? {
            id: row.vitals.id,
            weightKg: this.num(row.vitals.weightKg),
            systolic: row.vitals.systolic,
            diastolic: row.vitals.diastolic,
            pulseBpm: row.vitals.pulseBpm,
            temperatureC: this.num(row.vitals.temperatureC),
            respiratoryRate: row.vitals.respiratoryRate,
          }
        : null,
      clinicalNote: row.clinicalNote
        ? {
            id: row.clinicalNote.id,
            complaints: row.clinicalNote.complaints,
            observations: row.clinicalNote.observations,
            diagnoses: row.clinicalNote.diagnoses,
            advice: row.clinicalNote.advice,
            notes: row.clinicalNote.notes ?? null,
          }
        : null,
      prescription: row.prescription
        ? {
            id: row.prescription.id,
            signedAt: row.prescription.signedAt ?? null,
            investigations: row.prescription.investigations,
            followUpDate: row.prescription.followUpDate ?? null,
            items: (row.prescription.items ?? []).map((item: Record<string, any>) => ({
              drugName: item.drugName,
              strength: item.strength ?? null,
              form: item.form ?? null,
              durationDays: item.durationDays ?? null,
              morning: this.num(item.morning) ?? 0,
              noon: this.num(item.noon) ?? 0,
              night: this.num(item.night) ?? 0,
              mealRelation: item.mealRelation,
              instruction: item.instruction ?? null,
            })),
          }
        : null,
      documents: (row.documents ?? []).map((doc: Record<string, any>) => ({
        id: doc.id,
        category: doc.category as DocumentCategory,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        storageKey: doc.storageKey,
        capturedOn: doc.capturedOn ?? null,
        createdAt: doc.createdAt,
      })),
    };
  }
}
