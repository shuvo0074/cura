import { Inject, Injectable } from '@nestjs/common';
import { assertPracticeAccess } from '../../common/security/practice-access';
import {
  CHARTING_TEMPLATE_REPOSITORY,
  type ChartingTemplateRepository,
} from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/** Charting templates: canned diagnosis, lab-order and follow-up sets. */
@Injectable()
export class ChartingSettingsService {
  constructor(
    @Inject(CHARTING_TEMPLATE_REPOSITORY) private readonly templates: ChartingTemplateRepository,
  ) {}

  async listChartingTemplates(practiceId: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    return this.templates.listChartingTemplates(practiceId);
  }

  async upsertChartingTemplate(
    practiceId: string,
    data: { id?: string; name: string; diagnoses: string[]; labOrders: string[]; followUpDays: number | null },
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    return this.templates.upsertChartingTemplate(practiceId, data);
  }

  async deleteChartingTemplate(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    await this.templates.deleteChartingTemplate(practiceId, id);
    return { deleted: true };
  }
}
