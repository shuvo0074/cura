import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  BirthdayDue,
  EngagementRepository,
  FeedbackRecord,
  FeedbackSummary,
  FollowUpDue,
  OutreachPatient,
} from '../../core/ports/engagement.ports';

const patientSelect = { id: true, curaId: true, fullName: true, mobile: true, email: true } as const;

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

@Injectable()
export class PrismaEngagementRepository implements EngagementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async prescribedFollowUps(practiceId: string, from: Date, to: Date): Promise<FollowUpDue[]> {
    const rows = await this.prisma.prescription.findMany({
      where: {
        followUpDate: { gte: from, lte: to },
        encounter: { patient: { practiceId, deletedAt: null } },
      },
      select: { followUpDate: true, encounter: { select: { patient: { select: patientSelect } } } },
      orderBy: { followUpDate: 'asc' },
    });

    // One row per patient: a later prescription can restate the same follow-up,
    // and the outreach list is about whom to contact, not how often it was noted.
    const seen = new Set<string>();
    const due: FollowUpDue[] = [];
    for (const row of rows) {
      const patient = row.encounter.patient;
      if (!row.followUpDate || seen.has(patient.id)) continue;
      seen.add(patient.id);
      due.push({ patient, dueDate: isoDate(row.followUpDate), source: 'PRESCRIPTION' });
    }
    return due;
  }

  async recallsDue(practiceId: string, offsetDays: number, from: Date, to: Date): Promise<FollowUpDue[]> {
    const shift = offsetDays * 86_400_000;
    const rows = await this.prisma.patient.findMany({
      where: {
        practiceId,
        deletedAt: null,
        lastVisitAt: { gte: new Date(from.getTime() - shift), lte: new Date(to.getTime() - shift) },
        // Someone already booked back in does not need a recall.
        appointments: {
          none: { scheduledAt: { gte: from }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        },
      },
      select: { ...patientSelect, lastVisitAt: true },
      orderBy: { lastVisitAt: 'asc' },
    });

    return rows.map(({ lastVisitAt, ...patient }) => ({
      patient,
      dueDate: isoDate(new Date((lastVisitAt as Date).getTime() + shift)),
      source: 'RECALL' as const,
    }));
  }

  /**
   * Next birthday of each patient, computed in SQL so the year wrap
   * (a December window running into January) and 29 February are handled by
   * Postgres date arithmetic rather than reimplemented here.
   */
  async birthdaysDue(practiceId: string, from: Date, days: number): Promise<BirthdayDue[]> {
    const rows = await this.prisma.$queryRaw<
      Array<OutreachPatient & { next: Date; turning: number }>
    >(Prisma.sql`
      SELECT * FROM (
        SELECT p.id, p."curaId", p."fullName", p.mobile, p.email,
               (p."dateOfBirth" + make_interval(years => b.turning))::date AS next,
               b.turning
        FROM patients p
        CROSS JOIN LATERAL (
          SELECT date_part('year', age(${from}::date - 1, p."dateOfBirth"))::int + 1 AS turning
        ) b
        WHERE p."practiceId" = ${practiceId}::uuid
          AND p."deletedAt" IS NULL
          AND p."dateOfBirth" IS NOT NULL
      ) upcoming
      WHERE next <= ${from}::date + ${days}::int
      ORDER BY next
    `);

    return rows.map(({ next, turning, ...patient }) => ({
      patient,
      date: isoDate(next),
      turning,
    }));
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
