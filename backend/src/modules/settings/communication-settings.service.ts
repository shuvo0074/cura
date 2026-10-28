import { Inject, Injectable } from '@nestjs/common';
import { assertPracticeAccess } from '../../common/security/practice-access';
import {
  COMMUNICATION_SETTINGS_REPOSITORY,
  EMAIL_SETTINGS_REPOSITORY,
  type CommunicationSettingRecord,
  type CommunicationSettingsRepository,
  type EmailSettingRecord,
  type EmailSettingsRepository,
} from '../../core/ports/clinical.ports';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { SettingsAuditTrail } from './settings-audit';

/** Outbound patient messaging: the SMS/email notification matrix and the
 *  email header/footer blocks. */
@Injectable()
export class CommunicationSettingsService {
  /** Spec: Communications → "Category vs type". Fixed grid, not user-editable. */
  private static readonly COMMUNICATION_MATRIX: ReadonlyArray<{
    category: string;
    type: string;
    label: string;
    offsetDays: number | null;
  }> = [
    { category: 'APPOINTMENT', type: 'CONFIRMATION', label: 'Appointment confirmation', offsetDays: null },
    { category: 'APPOINTMENT', type: 'CANCELLATION', label: 'Appointment cancellation', offsetDays: null },
    { category: 'APPOINTMENT', type: 'REMINDER', label: 'Appointment reminder', offsetDays: 1 },
    // 180 days ≈ the six-month recall the spec calls out for category B.a.
    { category: 'FOLLOW_UP', type: 'REMINDER', label: 'Preventive follow-up reminder', offsetDays: 180 },
    { category: 'PAYMENT', type: 'INVOICE', label: 'Invoice', offsetDays: null },
    { category: 'WISHES', type: 'BIRTHDAY', label: 'Birthday wishes', offsetDays: null },
    { category: 'WISHES', type: 'ANNIVERSARY', label: 'Anniversary wishes', offsetDays: null },
  ];

  constructor(
    @Inject(COMMUNICATION_SETTINGS_REPOSITORY) private readonly communication: CommunicationSettingsRepository,
    @Inject(EMAIL_SETTINGS_REPOSITORY) private readonly email: EmailSettingsRepository,
    private readonly trail: SettingsAuditTrail,
  ) {}

  /**
   * The full notification matrix, not just the rows that happen to be stored.
   *
   * The spec fixes the category/type grid (Appointments ×3, Follow-up, Payment,
   * Wishes ×2), so a practice that has never saved a preference must still see
   * all seven rows with their defaults — otherwise the screen renders empty and
   * looks broken on a fresh account.
   */
  async listCommunication(practiceId: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    const stored = await this.communication.listCommunication(practiceId);
    const byKey = new Map(stored.map((row) => [`${row.category}:${row.type}`, row]));

    return CommunicationSettingsService.COMMUNICATION_MATRIX.map((cell) => {
      const saved = byKey.get(`${cell.category}:${cell.type}`);
      return {
        category: cell.category,
        type: cell.type,
        label: cell.label,
        smsEnabled: saved?.smsEnabled ?? false,
        emailEnabled: saved?.emailEnabled ?? false,
        offsetDays: saved?.offsetDays ?? cell.offsetDays,
      };
    });
  }

  async upsertCommunication(
    practiceId: string,
    record: CommunicationSettingRecord,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    await this.communication.upsertCommunication(practiceId, record);
    await this.trail.record(principal, practiceId, 'settings.communication.updated', 'practice', practiceId);
    return this.communication.listCommunication(practiceId);
  }

  // -- Email header / footer -------------------------------------------------

  /**
   * Always returns both sections. The editor renders a Header and a Footer tab
   * unconditionally, so an unsaved practice gets blank blocks rather than a tab
   * that has nothing behind it.
   */
  async getEmailSettings(practiceId: string, principal: AuthenticatedPrincipal) {
    assertPracticeAccess(principal, practiceId);
    const stored = await this.email.listEmailSettings(practiceId);
    const bySection = new Map(stored.map((row) => [row.section, row]));

    return ['HEADER', 'FOOTER'].map(
      (section) =>
        bySection.get(section) ?? {
          section,
          title: null,
          leftText: null,
          rightText: null,
          includeLogo: true,
        },
    );
  }

  async upsertEmailSetting(
    practiceId: string,
    record: EmailSettingRecord,
    principal: AuthenticatedPrincipal,
  ) {
    assertPracticeAccess(principal, practiceId);
    await this.email.upsertEmailSetting(practiceId, record);
    await this.trail.record(principal, practiceId, 'settings.email.updated', 'practice', practiceId);
    return this.getEmailSettings(practiceId, principal);
  }
}
