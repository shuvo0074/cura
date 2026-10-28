import { Inject, Injectable } from '@nestjs/common';
import { assertPracticeAccess } from '../../common/security/practice-access';
import { CONSENT_FORM_REPOSITORY, type ConsentFormRepository } from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/** Consent-form templates the practice presents to patients. */
@Injectable()
export class ConsentFormSettingsService {
  constructor(@Inject(CONSENT_FORM_REPOSITORY) private readonly forms: ConsentFormRepository) {}

  async listConsentForms(practiceId: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    return this.forms.listConsentForms(practiceId);
  }

  async upsertConsentForm(
    practiceId: string,
    data: { id?: string; title: string; bodyHtml: string; isActive: boolean },
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    return this.forms.upsertConsentForm(practiceId, data);
  }

  async deleteConsentForm(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    await this.forms.deleteConsentForm(practiceId, id);
    return { deleted: true };
  }
}
