import { Injectable } from '@nestjs/common';
import { AppointmentStatus, type VisitType } from '@cura/shared';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AppointmentRecord,
  AppointmentRepository,
  AppointmentWithPatient,
} from '../../core/ports/repositories';

@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  private static readonly PATIENT_SELECT = {
    id: true,
    curaId: true,
    fullName: true,
    mobile: true,
    gender: true,
    dateOfBirth: true,
    avatarUrl: true,
  } as const;

  /** Statuses that still occupy a slot for overlap purposes. */
  private static readonly BLOCKING: AppointmentStatus[] = [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.WAITING,
    AppointmentStatus.ENGAGED,
  ];

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AppointmentWithPatient | null> {
    const row = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: { select: PrismaAppointmentRepository.PATIENT_SELECT } },
    });
    return row ? (row as unknown as AppointmentWithPatient) : null;
  }

  /**
   * Calendar window read.
   *
   * A single query with the patient joined in avoids the N+1 that would follow
   * from loading appointments then fetching each patient — at 30+ slots a day
   * across a week view that is the difference between one round trip and 200.
   */
  async findInRange(input: {
    practiceId: string;
    doctorId?: string | undefined;
    from: Date;
    to: Date;
    includeCancelled: boolean;
  }): Promise<AppointmentWithPatient[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        practiceId: input.practiceId,
        ...(input.doctorId ? { doctorId: input.doctorId } : {}),
        scheduledAt: { gte: input.from, lt: input.to },
        ...(input.includeCancelled
          ? {}
          : { status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] as never } }),
      },
      include: { patient: { select: PrismaAppointmentRepository.PATIENT_SELECT } },
      orderBy: { scheduledAt: 'asc' },
    });
    return rows as unknown as AppointmentWithPatient[];
  }

  /**
   * Half-open interval overlap: `existing.start < new.end AND existing.end > new.start`.
   * Adjacent appointments (one ending exactly as the next begins) do not clash.
   */
  async findOverlapping(input: {
    doctorId: string;
    from: Date;
    to: Date;
    excludeId?: string | undefined;
  }): Promise<AppointmentRecord[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        doctorId: input.doctorId,
        status: { in: PrismaAppointmentRepository.BLOCKING as never },
        scheduledAt: { lt: input.to },
        endsAt: { gt: input.from },
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
    });
    return rows as unknown as AppointmentRecord[];
  }

  async create(input: {
    practiceId: string;
    doctorId: string;
    patientId: string;
    scheduledAt: Date;
    endsAt: Date;
    durationMinutes: number;
    visitType: VisitType;
    plannedProcedures: string[];
    notes: string | null;
    tokenNumber: number | null;
    createdById: string | null;
  }): Promise<AppointmentRecord> {
    const row = await this.prisma.appointment.create({
      data: {
        practiceId: input.practiceId,
        doctorId: input.doctorId,
        patientId: input.patientId,
        scheduledAt: input.scheduledAt,
        endsAt: input.endsAt,
        durationMinutes: input.durationMinutes,
        visitType: input.visitType as never,
        plannedProcedures: input.plannedProcedures,
        notes: input.notes,
        tokenNumber: input.tokenNumber,
        createdById: input.createdById,
      },
    });
    return row as unknown as AppointmentRecord;
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    at: Date,
  ): Promise<AppointmentRecord> {
    const timestamps: Record<string, Date> = {};
    if (status === AppointmentStatus.WAITING) timestamps.checkedInAt = at;
    if (status === AppointmentStatus.ENGAGED) timestamps.engagedAt = at;
    if (status === AppointmentStatus.DONE) timestamps.completedAt = at;
    if (status === AppointmentStatus.CANCELLED) timestamps.cancelledAt = at;

    const row = await this.prisma.appointment.update({
      where: { id },
      data: { status: status as never, ...timestamps },
    });
    return row as unknown as AppointmentRecord;
  }

  async reschedule(
    id: string,
    scheduledAt: Date,
    endsAt: Date,
    durationMinutes: number,
  ): Promise<AppointmentRecord> {
    const row = await this.prisma.appointment.update({
      where: { id },
      data: { scheduledAt, endsAt, durationMinutes },
    });
    return row as unknown as AppointmentRecord;
  }

  /**
   * Queue counters for the Information Box.
   *
   * `groupBy` returns all four buckets in one round trip instead of four
   * separate counts, which matters because this refreshes on every status
   * change broadcast.
   */
  async countsByStatus(
    practiceId: string,
    from: Date,
    to: Date,
  ): Promise<Record<AppointmentStatus, number>> {
    const rows = await this.prisma.appointment.groupBy({
      by: ['status'],
      where: { practiceId, scheduledAt: { gte: from, lt: to } },
      _count: { _all: true },
    });

    const result = {
      [AppointmentStatus.SCHEDULED]: 0,
      [AppointmentStatus.WAITING]: 0,
      [AppointmentStatus.ENGAGED]: 0,
      [AppointmentStatus.DONE]: 0,
      [AppointmentStatus.CANCELLED]: 0,
      [AppointmentStatus.NO_SHOW]: 0,
    } as Record<AppointmentStatus, number>;

    for (const row of rows) {
      result[row.status as AppointmentStatus] = row._count._all;
    }
    return result;
  }

  async nextTokenNumber(practiceId: string, doctorId: string, day: Date): Promise<number> {
    const start = new Date(day);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const result = await this.prisma.appointment.aggregate({
      where: { practiceId, doctorId, scheduledAt: { gte: start, lt: end } },
      _max: { tokenNumber: true },
    });
    return (result._max.tokenNumber ?? 0) + 1;
  }
}
