import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  HealthAppointment,
  HealthInvoice,
  HealthVisit,
  PatientHealthRepository,
} from '../../../core/ports/directory.ports';

/**
 * A patient's own clinic records, read-only.
 *
 * Every query starts from the clinic patient records linked to the caller's
 * website account (`patients.accountId`), so leaving a clinic (which clears that
 * link) hides its records at once. Select lists are explicit: staff-only fields
 * such as the doctor's private notes, observations, appointment notes, invoice
 * notes and anything in the audit trail are never read.
 */
@Injectable()
export class PrismaPatientHealthRepository implements PatientHealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  private ownPatients(accountId: string) {
    return { accountId, deletedAt: null };
  }

  async signedVisits(accountId: string, limit: number): Promise<HealthVisit[]> {
    const rows = await this.prisma.encounter.findMany({
      where: { signedAt: { not: null }, patient: this.ownPatients(accountId) },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        occurredAt: true,
        doctor: { select: { fullName: true } },
        appointment: { select: { doctor: { select: { fullName: true } } } },
        patient: { select: { practice: { select: { name: true } } } },
        clinicalNote: { select: { complaints: true, diagnoses: true, advice: true } },
        vitals: { select: { weightKg: true, systolic: true, diastolic: true, pulseBpm: true, temperatureC: true } },
        prescription: {
          select: {
            investigations: true,
            followUpDate: true,
            items: {
              orderBy: { position: 'asc' },
              select: {
                drugName: true,
                form: true,
                strength: true,
                morning: true,
                noon: true,
                night: true,
                mealRelation: true,
                durationDays: true,
                instruction: true,
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      clinicName: row.patient.practice.name,
      // The booked doctor. Whoever first opened the record (an owner or desk
      // staff opening it after booking) is only a fallback for walk-in visits.
      doctorName: row.appointment?.doctor.fullName ?? row.doctor.fullName,
      complaints: row.clinicalNote?.complaints ?? [],
      diagnoses: row.clinicalNote?.diagnoses ?? [],
      advice: row.clinicalNote?.advice ?? [],
      vitals: row.vitals
        ? {
            weightKg: num(row.vitals.weightKg),
            systolic: row.vitals.systolic,
            diastolic: row.vitals.diastolic,
            pulseBpm: row.vitals.pulseBpm,
            temperatureC: num(row.vitals.temperatureC),
          }
        : null,
      prescription: row.prescription
        ? {
            investigations: row.prescription.investigations,
            followUpDate: row.prescription.followUpDate,
            items: row.prescription.items.map((item) => ({
              ...item,
              morning: num(item.morning) ?? 0,
              noon: num(item.noon) ?? 0,
              night: num(item.night) ?? 0,
            })),
          }
        : null,
    }));
  }

  async invoices(accountId: string, limit: number): Promise<HealthInvoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        patient: this.ownPatients(accountId),
        // Drafts were never issued to the patient. Cancelled invoices follow the
        // clinic's own "hide cancelled invoices" setting, as on Cura Dashboard.
        OR: [
          { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] } },
          { status: 'CANCELLED', patient: { practice: { hideCancelledInvoices: false } } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        number: true,
        status: true,
        totalMinor: true,
        paidMinor: true,
        issuedAt: true,
        createdAt: true,
        patient: { select: { practice: { select: { name: true } } } },
        items: { orderBy: { id: 'asc' }, select: { description: true, quantity: true, totalMinor: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      date: row.issuedAt ?? row.createdAt,
      clinicName: row.patient.practice.name,
      status: row.status,
      totalMinor: row.totalMinor,
      paidMinor: row.paidMinor,
      items: row.items,
    }));
  }

  async upcomingAppointments(accountId: string, now: Date, limit: number): Promise<HealthAppointment[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        patient: this.ownPatients(accountId),
        status: { in: ['SCHEDULED', 'WAITING', 'ENGAGED'] },
        endsAt: { gte: now },
        // A visit the doctor already signed is over, even if nobody checked it out.
        OR: [{ encounter: { is: null } }, { encounter: { is: { signedAt: null } } }],
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        doctor: { select: { fullName: true } },
        practice: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      scheduledAt: row.scheduledAt,
      clinicName: row.practice.name,
      doctorName: row.doctor.fullName,
      status: row.status,
    }));
  }
}

/** Decimal columns arrive as Prisma Decimal; the patient sees plain numbers. */
function num(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value.toString());
}
