import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../../common/errors/domain-error';
import type {
  CommunicationSettingRecord,
  EmailSettingRecord,
  PracticeRecord,
  PracticeRepository,
  PrintoutSettingRecord,
  SettingsRepository,
  StaffNotificationPrefs,
  StaffRecord,
} from '../../core/ports/clinical.ports';

@Injectable()
export class PrismaPracticeRepository implements PracticeRepository {
  private static readonly SELECT = {
    id: true,
    name: true,
    specialization: true,
    contactNumber: true,
    email: true,
    website: true,
    binNumber: true,
    address: true,
    addressLine1: true,
    locality: true,
    city: true,
    country: true,
    postCode: true,
    mapsUrl: true,
    logoUrl: true,
    roomNumber: true,
    slotMinutes: true,
    timezone: true,
    showTodayFirst: true,
    smsLanguage: true,
    hideCancelledInvoices: true,
    hideCancelledPayments: true,
  } as const;

  private static readonly STAFF_SELECT = {
    id: true,
    role: true,
    isActive: true,
    notifyScheduleSms: true,
    notifyScheduleEmail: true,
    notifyAppointmentSms: true,
    notifyAppointmentEmail: true,
    user: {
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        bmdcNumber: true,
        isActive: true,
      },
    },
  } as const;

  private static toStaff(row: {
    id: string;
    role: string;
    isActive: boolean;
    notifyScheduleSms: boolean;
    notifyScheduleEmail: boolean;
    notifyAppointmentSms: boolean;
    notifyAppointmentEmail: boolean;
    user: {
      id: string;
      fullName: string;
      email: string | null;
      mobile: string | null;
      bmdcNumber: string | null;
      isActive: boolean;
    };
  }): StaffRecord {
    return {
      membershipId: row.id,
      userId: row.user.id,
      fullName: row.user.fullName,
      email: row.user.email,
      mobile: row.user.mobile,
      role: row.role,
      bmdcNumber: row.user.bmdcNumber,
      // Effective access requires both the account and the membership active.
      isActive: row.isActive && row.user.isActive,
      notifyScheduleSms: row.notifyScheduleSms,
      notifyScheduleEmail: row.notifyScheduleEmail,
      notifyAppointmentSms: row.notifyAppointmentSms,
      notifyAppointmentEmail: row.notifyAppointmentEmail,
    };
  }

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PracticeRecord | null> {
    return this.prisma.practice.findFirst({
      where: { id, deletedAt: null },
      select: PrismaPracticeRepository.SELECT,
    });
  }

  async update(id: string, patch: Partial<Omit<PracticeRecord, 'id'>>): Promise<PracticeRecord> {
    return this.prisma.practice.update({
      where: { id },
      data: patch,
      select: PrismaPracticeRepository.SELECT,
    });
  }

  async listSessions(practiceId: string) {
    return this.prisma.practiceSession.findMany({
      where: { practiceId },
      select: { dayOfWeek: true, startTime: true, endTime: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Sessions are replaced atomically.
   *
   * A delete-then-insert outside a transaction would leave a window where the
   * practice appears closed, and the calendar would render an empty grid to
   * anyone loading it at that instant.
   */
  async replaceSessions(
    practiceId: string,
    sessions: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.practiceSession.deleteMany({ where: { practiceId } }),
      this.prisma.practiceSession.createMany({
        data: sessions.map((s) => ({ practiceId, ...s })),
      }),
    ]);
  }

  async listClosures(practiceId: string, from: Date, to: Date) {
    return this.prisma.practiceClosure.findMany({
      where: { practiceId, startsAt: { lt: to }, endsAt: { gt: from } },
      select: { id: true, startsAt: true, endsAt: true, reason: true },
      orderBy: { startsAt: 'asc' },
    });
  }

  async addClosure(
    practiceId: string,
    input: { startsAt: Date; endsAt: Date; allDay: boolean; reason: string | null },
  ): Promise<{ id: string }> {
    return this.prisma.practiceClosure.create({
      data: { practiceId, ...input },
      select: { id: true },
    });
  }

  async removeClosure(practiceId: string, id: string): Promise<void> {
    await this.prisma.practiceClosure.deleteMany({ where: { id, practiceId } });
  }

  async listStaff(practiceId: string): Promise<StaffRecord[]> {
    const rows = await this.prisma.practiceMembership.findMany({
      where: { practiceId },
      select: PrismaPracticeRepository.STAFF_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => PrismaPracticeRepository.toStaff(row));
  }

  async addStaff(input: {
    practiceId: string;
    fullName: string;
    email: string | null;
    mobile: string | null;
    role: string;
    bmdcNumber: string | null;
    passwordHash: string;
  }): Promise<StaffRecord> {
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          mobile: input.mobile,
          bmdcNumber: input.bmdcNumber,
          passwordHash: input.passwordHash,
          role: input.role as never,
          onboardingComplete: true,
        },
        select: { id: true, fullName: true, email: true, mobile: true, bmdcNumber: true },
      });

      const membership = await tx.practiceMembership.create({
        data: {
          practiceId: input.practiceId,
          userId: user.id,
          role: input.role as never,
          isActive: true,
        },
        select: { id: true },
      });

      return { user, membershipId: membership.id };
    });

    return {
      membershipId: created.membershipId,
      userId: created.user.id,
      fullName: created.user.fullName,
      email: created.user.email,
      mobile: created.user.mobile,
      role: input.role,
      bmdcNumber: created.user.bmdcNumber,
      isActive: true,
      notifyScheduleSms: true,
      notifyScheduleEmail: true,
      notifyAppointmentSms: true,
      notifyAppointmentEmail: true,
    };
  }

  /**
   * Edits a member's details and notification matrix.
   *
   * The membership is located by (practiceId, userId) rather than by its own id
   * so a caller from one practice can never address another practice's row.
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
  ): Promise<StaffRecord> {
    const membership = await this.prisma.practiceMembership.findUnique({
      where: { practiceId_userId: { practiceId, userId } },
      select: { id: true },
    });
    if (!membership) throw new NotFoundError('Staff member');

    const userPatch = {
      ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.mobile !== undefined ? { mobile: patch.mobile } : {}),
      ...(patch.bmdcNumber !== undefined ? { bmdcNumber: patch.bmdcNumber } : {}),
      ...(patch.role !== undefined ? { role: patch.role as never } : {}),
    };

    const row = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userPatch).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userPatch });
      }
      return tx.practiceMembership.update({
        where: { id: membership.id },
        data: {
          ...(patch.role !== undefined ? { role: patch.role as never } : {}),
          ...(patch.notifications ?? {}),
        },
        select: PrismaPracticeRepository.STAFF_SELECT,
      });
    });

    return PrismaPracticeRepository.toStaff(row);
  }

  /**
   * The kill-switch.
   *
   * Deactivation flips the membership *and* bumps the user's token version,
   * which invalidates every access token already issued. Without that second
   * step a revoked assistant would keep working until their token expired.
   */
  async setStaffActive(practiceId: string, userId: string, isActive: boolean): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.practiceMembership.updateMany({
        where: { practiceId, userId },
        data: { isActive },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: isActive ? { isActive: true } : { isActive: false, tokenVersion: { increment: 1 } },
      }),
    ]);
  }
}

@Injectable()
export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCommunication(practiceId: string): Promise<CommunicationSettingRecord[]> {
    return this.prisma.communicationSetting.findMany({
      where: { practiceId },
      select: {
        category: true,
        type: true,
        smsEnabled: true,
        emailEnabled: true,
        offsetDays: true,
      },
      orderBy: [{ category: 'asc' }, { type: 'asc' }],
    });
  }

  async upsertCommunication(
    practiceId: string,
    record: CommunicationSettingRecord,
  ): Promise<void> {
    await this.prisma.communicationSetting.upsert({
      where: {
        practiceId_category_type: {
          practiceId,
          category: record.category,
          type: record.type,
        },
      },
      create: { practiceId, ...record },
      update: {
        smsEnabled: record.smsEnabled,
        emailEnabled: record.emailEnabled,
        offsetDays: record.offsetDays,
      },
    });
  }

  async getPrintout(practiceId: string, documentType: string): Promise<PrintoutSettingRecord | null> {
    const row = await this.prisma.printoutSetting.findUnique({
      where: { practiceId_documentType: { practiceId, documentType } },
    });
    if (!row) return null;
    const { id: _id, practiceId: _p, updatedAt: _u, ...rest } = row;
    return rest as PrintoutSettingRecord;
  }

  async upsertPrintout(practiceId: string, record: PrintoutSettingRecord): Promise<void> {
    await this.prisma.printoutSetting.upsert({
      where: {
        practiceId_documentType: { practiceId, documentType: record.documentType },
      },
      create: { practiceId, ...record },
      update: record,
    });
  }

  async listConsentForms(practiceId: string) {
    return this.prisma.consentFormTemplate.findMany({
      where: { practiceId },
      select: { id: true, title: true, bodyHtml: true, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * The update branch is scoped by practiceId as well as id.
   *
   * `update({ where: { id } })` alone would let a member of practice A rewrite
   * practice B's consent form by guessing a uuid — the service-level tenancy
   * check only proves the caller belongs to the practice they *named*, not that
   * the row does.
   */
  async upsertConsentForm(
    practiceId: string,
    data: { id?: string; title: string; bodyHtml: string; isActive: boolean },
  ): Promise<{ id: string }> {
    if (data.id) {
      const { count } = await this.prisma.consentFormTemplate.updateMany({
        where: { id: data.id, practiceId },
        data: { title: data.title, bodyHtml: data.bodyHtml, isActive: data.isActive },
      });
      if (count === 0) throw new NotFoundError('Consent form');
      return { id: data.id };
    }
    return this.prisma.consentFormTemplate.create({
      data: { practiceId, title: data.title, bodyHtml: data.bodyHtml, isActive: data.isActive },
      select: { id: true },
    });
  }

  async deleteConsentForm(practiceId: string, id: string): Promise<void> {
    await this.prisma.consentFormTemplate.deleteMany({ where: { id, practiceId } });
  }

  async listEmailSettings(practiceId: string): Promise<EmailSettingRecord[]> {
    return this.prisma.emailSetting.findMany({
      where: { practiceId },
      select: {
        section: true,
        title: true,
        leftText: true,
        rightText: true,
        includeLogo: true,
      },
      orderBy: { section: 'asc' },
    });
  }

  async upsertEmailSetting(practiceId: string, record: EmailSettingRecord): Promise<void> {
    await this.prisma.emailSetting.upsert({
      where: { practiceId_section: { practiceId, section: record.section } },
      create: { practiceId, ...record },
      update: {
        title: record.title,
        leftText: record.leftText,
        rightText: record.rightText,
        includeLogo: record.includeLogo,
      },
    });
  }

  async getSubscription(practiceId: string) {
    return this.prisma.subscription.findUnique({
      where: { practiceId },
      select: { plan: true, status: true, expiresAt: true },
    });
  }

  async upsertSubscription(practiceId: string, plan: string, expiresAt: Date | null): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { practiceId },
      create: { practiceId, plan, expiresAt },
      update: { plan, expiresAt },
    });
  }
}
