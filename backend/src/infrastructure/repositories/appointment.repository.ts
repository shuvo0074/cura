import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppointmentStatus, type VisitType } from '@cura/shared';
import { PrismaService } from '../prisma/prisma.service';
import { utc } from '../prisma/sql';
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

  /**
   * Exactly the columns of `AppointmentWithPatient` — the calendar's read path
   * returns hundreds of rows per request, so internal columns (author, cancel
   * metadata) are not hydrated and serialised for clients that never read them.
   */
  private static readonly SELECT = {
    id: true,
    practiceId: true,
    doctorId: true,
    patientId: true,
    scheduledAt: true,
    endsAt: true,
    durationMinutes: true,
    status: true,
    visitType: true,
    tokenNumber: true,
    plannedProcedures: true,
    notes: true,
    checkedInAt: true,
    engagedAt: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
    patient: { select: PrismaAppointmentRepository.PATIENT_SELECT },
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
      select: PrismaAppointmentRepository.SELECT,
    });
    return row ? (row as unknown as AppointmentWithPatient) : null;
  }

  /**
   * Calendar window read — the API's hottest path (a busy week is ~400 rows).
   *
   * One joined SQL query rather than Prisma `findMany` + `include`: Prisma
   * resolves the relation with a second query and stitches the rows together
   * in its engine, which roughly halved throughput on this endpoint under load.
   * Columns are exactly those of `AppointmentWithPatient`.
   */
  async findInRange(input: {
    practiceId: string;
    doctorId?: string | undefined;
    from: Date;
    to: Date;
    includeCancelled: boolean;
  }): Promise<AppointmentWithPatient[]> {
    const doctor = input.doctorId ? Prisma.sql`AND a."doctorId" = ${input.doctorId}::uuid` : Prisma.empty;
    const active = input.includeCancelled ? Prisma.empty : Prisma.sql`AND a.status NOT IN ('CANCELLED', 'NO_SHOW')`;
    const rows = await this.prisma.$queryRaw<Array<AppointmentRow>>(Prisma.sql`
      SELECT a.id, a."practiceId", a."doctorId", a."patientId", a."scheduledAt", a."endsAt",
             a."durationMinutes", a.status, a."visitType", a."tokenNumber", a."plannedProcedures",
             a.notes, a."checkedInAt", a."engagedAt", a."completedAt", a."createdAt", a."updatedAt",
             p."curaId" AS "p_curaId", p."fullName" AS "p_fullName", p.mobile AS p_mobile,
             p.gender AS p_gender, p."dateOfBirth" AS "p_dateOfBirth", p."avatarUrl" AS "p_avatarUrl"
      FROM appointments a
      JOIN patients p ON p.id = a."patientId"
      WHERE a."practiceId" = ${input.practiceId}::uuid
        AND a."scheduledAt" >= ${utc(input.from)} AND a."scheduledAt" < ${utc(input.to)}
        ${active}
        ${doctor}
      -- Token, then id: appointments sharing a start time keep a stable order.
      ORDER BY a."scheduledAt", a."tokenNumber" NULLS LAST, a.id
    `);
    return rows.map(toAppointmentWithPatient);
  }

  async listDoctors(practiceId: string): Promise<Array<{ id: string; fullName: string }>> {
    const rows = await this.prisma.practiceMembership.findMany({
      where: {
        practiceId,
        isActive: true,
        user: { isActive: true },
        OR: [{ role: 'DOCTOR' }, { user: { bmdcNumber: { not: null } } }],
      },
      select: { user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => row.user);
  }

  async dailyCounts(input: {
    practiceId: string;
    doctorId?: string | undefined;
    from: Date;
    to: Date;
    timeZone: string;
  }): Promise<Array<{ date: string; count: number }>> {
    // Grouped in SQL: a busy month is ~1,500 rows, and the caller only needs
    // ~30 numbers. Timestamps are stored as UTC, so the day is taken in the
    // viewer's zone — a 02:00 Dhaka visit belongs to its local date.
    const doctor = input.doctorId ? Prisma.sql`AND "doctorId" = ${input.doctorId}::uuid` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<Array<{ date: string; count: bigint }>>(Prisma.sql`
      SELECT to_char(("scheduledAt" AT TIME ZONE 'UTC') AT TIME ZONE ${input.timeZone}, 'YYYY-MM-DD') AS date,
             count(*) AS count
      FROM appointments
      WHERE "practiceId" = ${input.practiceId}::uuid
        AND "scheduledAt" >= ${utc(input.from)} AND "scheduledAt" < ${utc(input.to)}
        AND status NOT IN ('CANCELLED', 'NO_SHOW')
        ${doctor}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
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
    doctorId?: string | undefined,
  ): Promise<Record<AppointmentStatus, number>> {
    const rows = await this.prisma.appointment.groupBy({
      by: ['status'],
      where: { practiceId, scheduledAt: { gte: from, lt: to }, ...(doctorId ? { doctorId } : {}) },
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

/** Flat row of the calendar join; `p_*` columns are the patient's. */
interface AppointmentRow {
  id: string;
  practiceId: string;
  doctorId: string;
  patientId: string;
  scheduledAt: Date;
  endsAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  visitType: VisitType;
  tokenNumber: number | null;
  plannedProcedures: string[];
  notes: string | null;
  checkedInAt: Date | null;
  engagedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  p_curaId: string;
  p_fullName: string;
  p_mobile: string;
  p_gender: AppointmentWithPatient['patient']['gender'];
  p_dateOfBirth: Date | null;
  p_avatarUrl: string | null;
}

function toAppointmentWithPatient(row: AppointmentRow): AppointmentWithPatient {
  const { p_curaId, p_fullName, p_mobile, p_gender, p_dateOfBirth, p_avatarUrl, ...appointment } = row;
  return {
    ...appointment,
    patient: {
      id: row.patientId,
      curaId: p_curaId,
      fullName: p_fullName,
      mobile: p_mobile,
      gender: p_gender,
      dateOfBirth: p_dateOfBirth,
      avatarUrl: p_avatarUrl,
    },
  };
}
