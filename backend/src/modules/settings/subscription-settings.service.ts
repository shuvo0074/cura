import { Inject, Injectable } from '@nestjs/common';
import { assertPracticeAccess } from '../../common/security/practice-access';
import { SUBSCRIPTION_REPOSITORY, type SubscriptionRepository } from '../../core/ports/clinical.ports';
import { CLOCK, type Clock } from '../../core/ports/services';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { SettingsAuditTrail } from './settings-audit';

/** The practice's plan. A practice with no row is on the free plan. */
@Injectable()
export class SubscriptionSettingsService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly trail: SettingsAuditTrail,
  ) {}

  async getSubscription(practiceId: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    const existing = await this.subscriptions.getSubscription(practiceId);
    return existing ?? { plan: 'FREE', status: 'ACTIVE', expiresAt: null };
  }

  async setSubscription(
    practiceId: string,
    plan: string,
    months: number,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    const expiresAt = plan === 'FREE' ? null : this.clock.addDays(this.clock.now(), months * 30);
    await this.subscriptions.upsertSubscription(practiceId, plan, expiresAt);
    await this.trail.record(principal, practiceId, 'settings.subscription.changed', 'practice', practiceId);
    return this.getSubscription(practiceId, principal);
  }
}
