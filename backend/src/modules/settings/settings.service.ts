import { Inject, Injectable } from '@nestjs/common';
import { UserRole, type PracticeSessionInput } from '@cura/shared';
import { CryptoService } from '../../common/crypto/crypto.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/domain-error';
import {
  CATALOG_REPOSITORY,
  PRACTICE_REPOSITORY,
  SETTINGS_REPOSITORY,
  type CatalogRepository,
  type CommunicationSettingRecord,
  type EmailSettingRecord,
  type PracticeRepository,
  type PrintoutSettingRecord,
  type SettingsRepository,
  type StaffNotificationPrefs,
} from '../../core/ports/clinical.ports';
import { AUDIT_REPOSITORY, type AuditRepository } from '../../core/ports/repositories';
import { CLOCK, type Clock } from '../../core/ports/services';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/**
 * Practice settings: profile, sessions, staff, catalogs, communications,
 * printouts, consent forms and subscription.
 *
 * Every method takes the practice id as its first argument and asserts
 * membership before touching anything — settings are the most attractive
 * lateral-movement target in the system, so there is no unguarded path.
 */
@Injectable()
export class SettingsService {
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
    private readonly crypto: CryptoService,
    @Inject(PRACTICE_REPOSITORY) private readonly practices: PracticeRepository,
    @Inject(SETTINGS_REPOSITORY) private readonly settings: SettingsRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // -- Practice profile ------------------------------------------------------

  async getPractice(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
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
    this.assert(principal, practiceId);
    const updated = await this.practices.update(practiceId, patch);
    await this.trail(principal, practiceId, 'settings.practice.updated', 'practice', practiceId);
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
    this.assert(principal, practiceId);

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
    await this.trail(principal, practiceId, 'settings.sessions.replaced', 'practice', practiceId);
    return this.practices.listSessions(practiceId);
  }

  async listClosures(practiceId: string, from: Date, to: Date, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    return this.practices.listClosures(practiceId, from, to);
  }

  async addClosure(
    practiceId: string,
    input: { startsAt: Date; endsAt: Date; allDay: boolean; reason: string | null },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    if (input.endsAt <= input.startsAt) {
      throw new ValidationError('The closure end must be after its start.');
    }
    const result = await this.practices.addClosure(practiceId, input);
    await this.trail(principal, practiceId, 'settings.closure.added', 'practice', practiceId);
    return result;
  }

  async removeClosure(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    await this.practices.removeClosure(practiceId, id);
    return { removed: true };
  }

  // -- Staff -----------------------------------------------------------------

  async listStaff(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    return this.practices.listStaff(practiceId);
  }

  async addStaff(
    practiceId: string,
    input: {
      fullName: string;
      email: string | null;
      mobile: string | null;
      role: string;
      bmdcNumber: string | null;
      temporaryPassword: string;
    },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);

    // BMDC registration is mandatory for anyone who practises and irrelevant
    // for the front desk.
    if (input.role === UserRole.DOCTOR && !input.bmdcNumber) {
      throw new ValidationError('A BMDC registration number is required for doctors.');
    }

    const staff = await this.practices.addStaff({
      practiceId,
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      role: input.role,
      bmdcNumber: input.bmdcNumber,
      passwordHash: await this.crypto.hashPassword(input.temporaryPassword),
    });

    await this.trail(principal, practiceId, 'settings.staff.added', 'user', staff.userId);
    return staff;
  }

  /**
   * Instant access revocation.
   *
   * Ends the member's active sessions immediately — the repository bumps their
   * token version, so already-issued access tokens stop verifying on the next
   * request rather than at expiry.
   */
  async setStaffActive(
    practiceId: string,
    userId: string,
    isActive: boolean,
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    if (userId === principal.userId && !isActive) {
      throw new ConflictError('CANNOT_DISABLE_SELF', 'You cannot deactivate your own account.');
    }

    await this.practices.setStaffActive(practiceId, userId, isActive);
    await this.trail(
      principal,
      practiceId,
      isActive ? 'settings.staff.reactivated' : 'settings.staff.deactivated',
      'user',
      userId,
    );
    return { userId, isActive };
  }

  /**
   * Edits a member's record and notification matrix.
   *
   * Demoting yourself is rejected for the same reason self-deactivation is: a
   * sole administrator who picks "Consultant" locks the practice out of its own
   * settings with no way back in.
   */
  async updateStaff(
    practiceId: string,
    userId: string,
    patch: {
      fullName?: string;
      email?: string | null;
      mobile?: string | null;
      bmdcNumber?: string | null;
      role?: string;
      notifications?: Partial<StaffNotificationPrefs>;
    },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);

    if (patch.role && userId === principal.userId) {
      throw new ConflictError('CANNOT_DEMOTE_SELF', 'You cannot change your own access level.');
    }
    if (patch.role === UserRole.DOCTOR && patch.bmdcNumber === null) {
      throw new ValidationError('A BMDC registration number is required for doctors.');
    }

    const updated = await this.practices.updateStaff(practiceId, userId, patch);
    await this.trail(principal, practiceId, 'settings.staff.updated', 'user', userId);
    return updated;
  }

  // -- Catalogs --------------------------------------------------------------

  async searchDrugs(practiceId: string, term: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    return this.catalog.searchDrugs(practiceId, term, 20);
  }

  async listDrugs(practiceId: string, term: string | undefined, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    return this.catalog.listDrugs(practiceId, term, 200);
  }

  async updateDrug(
    practiceId: string,
    id: string,
    data: { name: string; form: string | null; strength: string | null; unit: string | null; instruction: string | null },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    return this.catalog.updateDrug(practiceId, id, data);
  }

  async updateCatalogEntry(
    practiceId: string,
    id: string,
    value: string,
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    return this.catalog.updateEntry(practiceId, id, value);
  }

  async createDrug(
    practiceId: string,
    data: { name: string; form: string | null; strength: string | null; unit: string | null; instruction: string | null },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    return this.catalog.createDrug(practiceId, data);
  }

  async deleteDrug(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    await this.catalog.deleteDrug(practiceId, id);
    return { deleted: true };
  }

  async listCatalog(
    practiceId: string,
    kind: string,
    term: string | undefined,
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    return this.catalog.listEntries(practiceId, kind, term);
  }

  async createCatalogEntry(
    practiceId: string,
    kind: string,
    value: string,
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    return this.catalog.createEntry(practiceId, kind, value);
  }

  async deleteCatalogEntry(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    await this.catalog.deleteEntry(practiceId, id);
    return { deleted: true };
  }

  async listPricing(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    return this.catalog.listPricing(practiceId);
  }

  async upsertPricing(
    practiceId: string,
    data: { id?: string; name: string; priceMinor: number; notes: string | null },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    if (data.priceMinor < 0) throw new ValidationError('Price cannot be negative.');
    return this.catalog.upsertPricing(practiceId, { ...data, isDefault: false });
  }

  async deletePricing(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    await this.catalog.deletePricing(practiceId, id);
    return { deleted: true };
  }

  async listChartingTemplates(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    return this.catalog.listChartingTemplates(practiceId);
  }

  async upsertChartingTemplate(
    practiceId: string,
    data: { id?: string; name: string; diagnoses: string[]; labOrders: string[]; followUpDays: number | null },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    return this.catalog.upsertChartingTemplate(practiceId, data);
  }

  async deleteChartingTemplate(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    await this.catalog.deleteChartingTemplate(practiceId, id);
    return { deleted: true };
  }

  // -- Communications, printouts, consent, subscription ----------------------

  /**
   * The full notification matrix, not just the rows that happen to be stored.
   *
   * The spec fixes the category/type grid (Appointments ×3, Follow-up, Payment,
   * Wishes ×2), so a practice that has never saved a preference must still see
   * all seven rows with their defaults — otherwise the screen renders empty and
   * looks broken on a fresh account.
   */
  async listCommunication(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    const stored = await this.settings.listCommunication(practiceId);
    const byKey = new Map(stored.map((row) => [`${row.category}:${row.type}`, row]));

    return SettingsService.COMMUNICATION_MATRIX.map((cell) => {
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
    this.assert(principal, practiceId);
    await this.settings.upsertCommunication(practiceId, record);
    await this.trail(principal, practiceId, 'settings.communication.updated', 'practice', practiceId);
    return this.settings.listCommunication(practiceId);
  }

  async getPrintout(practiceId: string, documentType: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    const stored = await this.settings.getPrintout(practiceId, documentType);
    return stored ?? this.defaultPrintout(documentType);
  }

  async upsertPrintout(
    practiceId: string,
    record: PrintoutSettingRecord,
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    await this.settings.upsertPrintout(practiceId, record);
    return record;
  }

  async listConsentForms(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    return this.settings.listConsentForms(practiceId);
  }

  async upsertConsentForm(
    practiceId: string,
    data: { id?: string; title: string; bodyHtml: string; isActive: boolean },
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    return this.settings.upsertConsentForm(practiceId, data);
  }

  async deleteConsentForm(practiceId: string, id: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    await this.settings.deleteConsentForm(practiceId, id);
    return { deleted: true };
  }

  // -- Email header / footer -------------------------------------------------

  /**
   * Always returns both sections. The editor renders a Header and a Footer tab
   * unconditionally, so an unsaved practice gets blank blocks rather than a tab
   * that has nothing behind it.
   */
  async getEmailSettings(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    const stored = await this.settings.listEmailSettings(practiceId);
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
    this.assert(principal, practiceId);
    await this.settings.upsertEmailSetting(practiceId, record);
    await this.trail(principal, practiceId, 'settings.email.updated', 'practice', practiceId);
    return this.getEmailSettings(practiceId, principal);
  }

  async getSubscription(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assert(principal, practiceId);
    const existing = await this.settings.getSubscription(practiceId);
    return existing ?? { plan: 'FREE', status: 'ACTIVE', expiresAt: null };
  }

  async setSubscription(
    practiceId: string,
    plan: string,
    months: number,
    principal: AuthenticatedPrincipal,
  ) {
    this.assert(principal, practiceId);
    const expiresAt = plan === 'FREE' ? null : this.clock.addDays(this.clock.now(), months * 30);
    await this.settings.upsertSubscription(practiceId, plan, expiresAt);
    await this.trail(principal, practiceId, 'settings.subscription.changed', 'practice', practiceId);
    return this.getSubscription(practiceId, principal);
  }

  // -------------------------------------------------------------------------

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

  private assert(principal: AuthenticatedPrincipal, practiceId: string): void {
    if (!principal.practiceIds.includes(practiceId)) {
      throw new ForbiddenError('You do not have access to this practice.');
    }
  }

  private trail(
    principal: AuthenticatedPrincipal,
    practiceId: string,
    action: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    return this.audit.record({
      actorUserId: principal.userId,
      action,
      resourceType,
      resourceId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });
  }
}
