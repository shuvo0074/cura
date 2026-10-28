import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { utc } from '../prisma/sql';
import type {
  BirthdayDue,
  Capped,
  EngagementRepository,
  FeedbackRecord,
  FeedbackSummary,
  FollowUpDue,
  OutreachPatient,
} from '../../core/ports/engagement.ports';

const patientSelect = { id: true, curaId: true, fullName: true, mobile: true, email: true } as const;

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** MMDD keys (e.g. 1028) for each day from `fromDate` over `days` days. */
function monthDaysInWindow(fromDate: string, days: number): number[] {
  const keys = new Set<number>();
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  for (let i = 0; i <= days; i += 1) {
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    keys.add(month * 100 + day);
    // In a common year a 29 February birthday is celebrated on the 28th.
    const year = cursor.getUTCFullYear();
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (month === 2 && day === 28 && !leap) keys.add(229);
    cursor.setUTCDate(day + 1);
  }
  return [...keys];
}

@Injectable()
export class PrismaEngagementRepository implements EngagementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async prescribedFollowUps(
    practiceId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Capped<FollowUpDue>> {
    // DISTINCT ON keeps one row per patient (a later prescription can restate
    // the same follow-up) in SQL, so only the capped page leaves the database.
    const rows = await this.prisma.$queryRaw<Array<OutreachPatient & { due: Date; total: bigint }>>(Prisma.sql`
      SELECT *, count(*) OVER () AS total FROM (
        SELECT DISTINCT ON (p.id) p.id, p."curaId", p."fullName", p.mobile, p.email, pr."followUpDate" AS due
        FROM prescriptions pr
        JOIN encounters e ON e.id = pr."encounterId"
        JOIN patients p ON p.id = e."patientId"
        WHERE pr."followUpDate" BETWEEN ${from}::date AND ${to}::date
          AND p."practiceId" = ${practiceId}::uuid
          AND p."deletedAt" IS NULL
        ORDER BY p.id, pr."followUpDate"
      ) per_patient
      ORDER BY due, "fullName"
      LIMIT ${limit}
    `);
    return {
      items: rows.map(({ due, total: _total, ...patient }) => ({
        patient,
        dueDate: isoDate(due),
        source: 'PRESCRIPTION' as const,
      })),
      total: Number(rows[0]?.total ?? 0),
    };
  }

  async recallsDue(
    practiceId: string,
    offsetDays: number,
    window: { from: Date; to: Date; fromDate: string; toDate: string },
    limit: number,
  ): Promise<Capped<FollowUpDue>> {
    // Hand-written rather than Prisma `none` filters: Prisma compiles those to
    // `id NOT IN (SELECT …)` over every future appointment — tens of thousands
    // of rows at practice scale, twice per request (rows + count). Correlated
    // NOT EXISTS probes the (patientId, scheduledAt) index per candidate.
    const shift = offsetDays * 86_400_000;
    const rows = await this.prisma.$queryRaw<Array<OutreachPatient & { lastVisitAt: Date; total: bigint }>>(Prisma.sql`
      SELECT p.id, p."curaId", p."fullName", p.mobile, p.email, p."lastVisitAt", count(*) OVER () AS total
      FROM patients p
      WHERE p."practiceId" = ${practiceId}::uuid
        AND p."deletedAt" IS NULL
        AND p."lastVisitAt" BETWEEN ${utc(new Date(window.from.getTime() - shift))} AND ${utc(new Date(window.to.getTime() - shift))}
        -- Already booked back in: no recall needed.
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a."patientId" = p.id AND a."scheduledAt" >= ${utc(window.from)}
            AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
        )
        -- A written follow-up in the window outranks the generic recall; the
        -- prescribed list already carries this patient.
        AND NOT EXISTS (
          SELECT 1 FROM encounters e JOIN prescriptions pr ON pr."encounterId" = e.id
          WHERE e."patientId" = p.id
            AND pr."followUpDate" BETWEEN ${window.fromDate}::date AND ${window.toDate}::date
        )
      ORDER BY p."lastVisitAt", p."fullName"
      LIMIT ${limit}
    `);

    return {
      items: rows.map(({ lastVisitAt, total: _total, ...patient }) => ({
        patient,
        dueDate: isoDate(new Date(lastVisitAt.getTime() + shift)),
        source: 'RECALL' as const,
      })),
      total: Number(rows[0]?.total ?? 0),
    };
  }

  /**
   * Next birthday of each patient whose month-day falls in the window.
   *
   * The month-day filter is what `patients_birthday_idx` serves — the
   * expression must match that index exactly. Postgres date arithmetic then
   * handles the year wrap and 29 February (which lands on the 28th in a
   * common year, so 0229 is also matched on those years' 28 February).
   */
  async birthdaysDue(
    practiceId: string,
    fromDate: string,
    days: number,
    limit: number,
  ): Promise<Capped<BirthdayDue>> {
    const monthDays = monthDaysInWindow(fromDate, days);
    const rows = await this.prisma.$queryRaw<
      Array<OutreachPatient & { next: Date; turning: number; total: bigint }>
    >(Prisma.sql`
      SELECT p.id, p."curaId", p."fullName", p.mobile, p.email, b.next, t.turning, count(*) OVER () AS total
      FROM patients p
      CROSS JOIN LATERAL (
        SELECT date_part('year', age(${fromDate}::date - 1, p."dateOfBirth"))::int + 1 AS turning
      ) t
      CROSS JOIN LATERAL (
        SELECT (p."dateOfBirth" + make_interval(years => t.turning))::date AS next
      ) b
      WHERE p."practiceId" = ${practiceId}::uuid
        AND p."dateOfBirth" IS NOT NULL
        AND p."deletedAt" IS NULL
        AND (EXTRACT(MONTH FROM p."dateOfBirth") * 100 + EXTRACT(DAY FROM p."dateOfBirth"))::int = ANY(${monthDays}::int[])
        AND b.next <= ${fromDate}::date + ${days}::int
      ORDER BY b.next, p."fullName"
      LIMIT ${limit}
    `);

    return {
      items: rows.map(({ next, turning, total: _total, ...patient }) => ({ patient, date: isoDate(next), turning })),
      total: Number(rows[0]?.total ?? 0),
    };
  }

  async listFeedback(
    practiceId: string,
    filter: { rating?: number; unanswered?: boolean },
  ): Promise<FeedbackRecord[]> {
    const rows = await this.prisma.patientFeedback.findMany({
      where: {
        practiceId,
        ...(filter.rating ? { rating: filter.rating } : {}),
        ...(filter.unanswered ? { reply: null } : {}),
      },
      include: { patient: { select: patientSelect } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toFeedback);
  }

  async feedbackSummary(practiceId: string): Promise<FeedbackSummary> {
    const groups = await this.prisma.patientFeedback.groupBy({
      by: ['rating'],
      where: { practiceId },
      _count: { _all: true },
    });

    const distribution: FeedbackSummary['distribution'] = [0, 0, 0, 0, 0];
    let count = 0;
    let total = 0;
    for (const g of groups) {
      distribution[g.rating - 1] = g._count._all;
      count += g._count._all;
      total += g.rating * g._count._all;
    }
    return { count, average: count ? Math.round((total / count) * 10) / 10 : null, distribution };
  }

  async createFeedback(data: {
    practiceId: string;
    patientId: string;
    appointmentId: string | null;
    rating: number;
    comment: string | null;
    createdById: string;
  }): Promise<FeedbackRecord> {
    const row = await this.prisma.patientFeedback.create({
      data,
      include: { patient: { select: patientSelect } },
    });
    return toFeedback(row);
  }

  async replyToFeedback(
    practiceId: string,
    id: string,
    reply: string,
    userId: string,
  ): Promise<FeedbackRecord | null> {
    // updateMany scopes the write to the practice in the same statement, so an
    // id from another practice is a no-op rather than a cross-tenant edit.
    const { count } = await this.prisma.patientFeedback.updateMany({
      where: { id, practiceId },
      data: { reply, repliedAt: new Date(), repliedById: userId },
    });
    if (count === 0) return null;

    const row = await this.prisma.patientFeedback.findUniqueOrThrow({
      where: { id },
      include: { patient: { select: patientSelect } },
    });
    return toFeedback(row);
  }

  async patientInPractice(practiceId: string, patientId: string): Promise<boolean> {
    const found = await this.prisma.patient.count({ where: { id: patientId, practiceId, deletedAt: null } });
    return found > 0;
  }

  async recallOffsetDays(practiceId: string): Promise<number | null> {
    const row = await this.prisma.communicationSetting.findUnique({
      where: { practiceId_category_type: { practiceId, category: 'FOLLOW_UP', type: 'REMINDER' } },
      select: { offsetDays: true },
    });
    return row?.offsetDays ?? null;
  }
}

function toFeedback(row: {
  id: string;
  appointmentId: string | null;
  rating: number;
  comment: string | null;
  reply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
  patient: OutreachPatient;
}): FeedbackRecord {
  return {
    id: row.id,
    patient: row.patient,
    appointmentId: row.appointmentId,
    rating: row.rating,
    comment: row.comment,
    reply: row.reply,
    repliedAt: row.repliedAt,
    createdAt: row.createdAt,
  };
}
