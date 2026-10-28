import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../core/ports/services';
import { ENGAGEMENT_REPOSITORY, type EngagementRepository } from '../../core/ports/engagement.ports';
import { AUDIT_REPOSITORY, type AuditRepository } from '../../core/ports/repositories';
import { ForbiddenError, NotFoundError } from '../../common/errors/domain-error';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/** The six-month preventive recall the spec names for category B.a. */
const DEFAULT_RECALL_DAYS = 180;

/** Outreach dates are the clinic's calendar days, as elsewhere in the API. */
const PRACTICE_TIME_ZONE = 'Asia/Dhaka';

const localDate = (instant: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: PRACTICE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

/**
 * Patient engagement: who to contact next (Communications) and what patients
 * said about their visits (Feedback Management).
 */
@Injectable()
export class EngagementService {
  constructor(
    @Inject(ENGAGEMENT_REPOSITORY) private readonly repo: EngagementRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Outreach list for the next `days` days: prescribed follow-ups, preventive
   * recalls and birthdays. Read-only — sending is the scheduler's job, gated by
   * the Communications settings matrix.
   *
   * Each list is capped at `limit` with its true total alongside: at practice
   * scale a 30-day birthday list runs to four figures, which no front desk can
   * act on from one screen and which made this the API's heaviest response.
   */
  async upcoming(principal: AuthenticatedPrincipal, practiceId: string, days: number, limit: number) {
    this.assert(principal, practiceId);
    const from = this.clock.startOfDay(this.clock.now(), PRACTICE_TIME_ZONE);
    const to = this.clock.addDays(from, days);
    // Local calendar dates: date columns compared against a UTC instant would
    // start the window a day early for a UTC+6 practice.
    const fromDate = localDate(from);
    const toDate = localDate(to);
    const recallDays = (await this.repo.recallOffsetDays(practiceId)) ?? DEFAULT_RECALL_DAYS;

    const [prescribed, recalls, birthdays] = await Promise.all([
      this.repo.prescribedFollowUps(practiceId, fromDate, toDate, limit),
      this.repo.recallsDue(practiceId, recallDays, { from, to, fromDate, toDate }, limit),
      this.repo.birthdaysDue(practiceId, fromDate, days, limit),
    ]);

    // The two follow-up sources are disjoint (see recallsDue), so merging their
    // first `limit` rows by date yields the true first `limit` of the union.
    const followUps = [...prescribed.items, ...recalls.items]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, limit);

    return {
      days,
      recallDays,
      limit,
      followUps,
      birthdays: birthdays.items,
      totals: { followUps: prescribed.total + recalls.total, birthdays: birthdays.total },
    };
  }

  async listFeedback(
    principal: AuthenticatedPrincipal,
    practiceId: string,
    filter: { rating?: number; unanswered?: boolean },
  ) {
    this.assert(principal, practiceId);
    const [summary, items] = await Promise.all([
      this.repo.feedbackSummary(practiceId),
      this.repo.listFeedback(practiceId, filter),
    ]);
    return { summary, items };
  }

  async recordFeedback(
    principal: AuthenticatedPrincipal,
    input: { practiceId: string; patientId: string; appointmentId?: string; rating: number; comment?: string },
  ) {
    this.assert(principal, input.practiceId);
    if (!(await this.repo.patientInPractice(input.practiceId, input.patientId))) {
      throw new NotFoundError('Patient');
    }

    const record = await this.repo.createFeedback({
      practiceId: input.practiceId,
      patientId: input.patientId,
      appointmentId: input.appointmentId ?? null,
      rating: input.rating,
      comment: input.comment?.trim() || null,
      createdById: principal.userId,
    });
    await this.trail(principal, 'feedback.recorded', input.practiceId, record.id);
    return record;
  }

  async reply(principal: AuthenticatedPrincipal, practiceId: string, id: string, reply: string) {
    this.assert(principal, practiceId);
    const record = await this.repo.replyToFeedback(practiceId, id, reply.trim(), principal.userId);
    if (!record) throw new NotFoundError('Feedback');
    await this.trail(principal, 'feedback.replied', practiceId, id);
    return record;
  }

  private assert(principal: AuthenticatedPrincipal, practiceId: string): void {
    if (!principal.practiceIds.includes(practiceId)) {
      throw new ForbiddenError('You do not have access to this practice.');
    }
  }

  private trail(principal: AuthenticatedPrincipal, action: string, practiceId: string, id: string) {
    return this.audit.record({
      actorUserId: principal.userId,
      action,
      resourceType: 'PatientFeedback',
      resourceId: id,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });
  }
}
