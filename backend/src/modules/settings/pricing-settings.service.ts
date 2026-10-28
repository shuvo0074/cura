import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../common/errors/domain-error';
import { assertPracticeAccess } from '../../common/security/practice-access';
import { PRICING_REPOSITORY, type PricingRepository } from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/** The practice's price list — what billing looks up when an invoice line
 *  references a catalog item. */
@Injectable()
export class PricingSettingsService {
  constructor(@Inject(PRICING_REPOSITORY) private readonly pricing: PricingRepository) {}

  async listPricing(practiceId: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    return this.pricing.listPricing(practiceId);
  }

  async upsertPricing(
    practiceId: string,
    data: { id?: string; name: string; priceMinor: number; notes: string | null },
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    if (data.priceMinor < 0) throw new ValidationError('Price cannot be negative.');
    return this.pricing.upsertPricing(practiceId, { ...data, isDefault: false });
  }

  async deletePricing(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    await this.pricing.deletePricing(practiceId, id);
    return { deleted: true };
  }
}
