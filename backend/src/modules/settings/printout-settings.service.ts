import { Inject, Injectable } from '@nestjs/common';
import { assertPracticeAccess } from '../../common/security/practice-access';
import {
  PRINTOUT_SETTINGS_REPOSITORY,
  type PrintoutSettingRecord,
  type PrintoutSettingsRepository,
} from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/** Page setup for printed EMR and billing documents. */
@Injectable()
export class PrintoutSettingsService {
  constructor(
    @Inject(PRINTOUT_SETTINGS_REPOSITORY) private readonly printouts: PrintoutSettingsRepository,
  ) {}

  async getPrintout(practiceId: string, documentType: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    const stored = await this.printouts.getPrintout(practiceId, documentType);
    return stored ?? this.defaultPrintout(documentType);
  }

  async upsertPrintout(
    practiceId: string,
    record: PrintoutSettingRecord,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    await this.printouts.upsertPrintout(practiceId, record);
    return record;
  }

  /**
   * Defaults for a practice that has never opened the printout editor. Matches
   * the spec's page-setup panel so the first render is not blank.
   */
  private defaultPrintout(documentType: string): PrintoutSettingRecord {
    return {
      documentType,
      printerType: 'COLOUR',
      paperSize: 'A4',
      orientation: 'PORTRAIT',
      marginTopMm: 50,
      marginBottomMm: 12,
      marginLeftMm: 6,
      marginRightMm: 6,
      fontScale: 100,
      showHeader: true,
      showFooter: true,
      headerHtml: null,
      footerHtml: null,
      padImageKey: null,
      sectionOrder: ['vitals', 'complaints', 'diagnosis', 'prescription', 'investigations', 'advice'],
    };
  }
}
