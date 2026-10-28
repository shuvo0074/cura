import { Inject, Injectable } from '@nestjs/common';
import type { PracticeSessionInput } from '@cura/shared';
import { NotFoundError, ValidationError } from '../../common/errors/domain-error';
import { assertPracticeAccess } from '../../common/security/practice-access';
import { PRACTICE_REPOSITORY, type PracticeRepository } from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { SettingsAuditTrail } from './settings-audit';

/**
 * The practice itself: profile, weekly sessions and closures. Calendar
 * defaults, data-security flags and SMS language are columns on the practice,
 * so they are written through `updatePractice` too.
 *
 * Every method takes the practice id as its first argument and asserts
 * membership before touching anything — settings are the most attractive
 * lateral-movement target in the system, so there is no unguarded path.
 */
@Injectable()
export class PracticeSettingsService {
  constructor(
    @Inject(PRACTICE_REPOSITORY) private readonly practices: PracticeRepository,
    private readonly trail: SettingsAuditTrail,
  ) {}

  async getPractice(practiceId: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    const practice = await this.practices.findById(practiceId);
    if (!practice) throw new NotFoundError('Practice');
    const sessions = await this.practices.listSessions(practiceId);
    return { ...practice, sessions };
  }

  async updatePractice(
    practiceId: string,
    patch: Record<string, unknown>,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    const updated = await this.practices.update(practiceId, patch);
    await this.trail.record(principal, practiceId, 'settings.practice.updated', 'practice', practiceId);
    return updated;
  }

  /**
   * Replaces the weekly session grid.
   *
   * Overlap is rejected here rather than at the database: two sessions on one
   * day that overlap would generate duplicate calendar slots, and the doctor
   * would be double-bookable against themselves.
   */
  async replaceSessions(
    practiceId: string,
    sessions: PracticeSessionInput[],
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);

    const byDay = new Map<number, PracticeSessionInput[]>();
    for (const session of sessions) {
      const list = byDay.get(session.dayOfWeek) ?? [];
      list.push(session);
      byDay.set(session.dayOfWeek, list);
    }

    for (const [day, list] of byDay) {
      const sorted = [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i]!.startTime < sorted[i - 1]!.endTime) {
          throw new ValidationError(
            `Sessions overlap on day ${day}. Adjust the times so they do not intersect.`,
          );
        }
      }
    }

    await this.practices.replaceSessions(practiceId, sessions);
    await this.trail.record(principal, practiceId, 'settings.sessions.replaced', 'practice', practiceId);
    return this.practices.listSessions(practiceId);
  }

  async listClosures(practiceId: string, from: Date, to: Date, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    return this.practices.listClosures(practiceId, from, to);
  }

  async addClosure(
    practiceId: string,
    input: { startsAt: Date; endsAt: Date; allDay: boolean; reason: string | null },
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    if (input.endsAt <= input.startsAt) {
      throw new ValidationError('The closure end must be after its start.');
    }
    const result = await this.practices.addClosure(practiceId, input);
    await this.trail.record(principal, practiceId, 'settings.closure.added', 'practice', practiceId);
    return result;
  }

  async removeClosure(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    await this.practices.removeClosure(practiceId, id);
    return { removed: true };
  }
}
