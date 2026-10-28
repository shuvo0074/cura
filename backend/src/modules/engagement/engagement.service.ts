import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../core/ports/services';
import { ENGAGEMENT_REPOSITORY, type EngagementRepository } from '../../core/ports/engagement.ports';
import { AUDIT_REPOSITORY, type AuditRepository } from '../../core/ports/repositories';
import { ForbiddenError, NotFoundError } from '../../common/errors/domain-error';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/** The six-month preventive recall the spec names for category B.a. */
const DEFAULT_RECALL_DAYS = 180;

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
   */
  async upcoming(principal: AuthenticatedPrincipal, practiceId: string, days: number) {
    this.assert(principal, practiceId);
    const from = this.clock.startOfDay(this.clock.now(), 'Asia/Dhaka');
    const to = this.clock.addDays(from, days);
    const recallDays = (await this.repo.recallOffsetDays(practiceId)) ?? DEFAULT_RECALL_DAYS;

    const [prescribed, recalls, birthdays] = await Promise.all([
      this.repo.prescribedFollowUps(practiceId, from, to),
      this.repo.recallsDue(practiceId, recallDays, from, to),
      this.repo.birthdaysDue(practiceId, from, days),
    ]);

    // A written follow-up outranks the generic recall for the same patient.
    const prescribedIds = new Set(prescribed.map((f) => f.patient.id));
    const followUps = [...prescribed, ...recalls.filter((r) => !prescribedIds.has(r.patient.id))].sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate),
    );

    return { days, recallDays, followUps, birthdays };
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
