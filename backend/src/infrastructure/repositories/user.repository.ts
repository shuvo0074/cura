import { Injectable } from '@nestjs/common';
import type { UserRole } from '@cura/shared';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateUserInput,
  UserRecord,
  UserRepository,
} from '../../core/ports/repositories';

/**
 * Prisma adapter for `UserRepository`.
 *
 * Every query selects an explicit field list. Beyond the performance benefit,
 * it means a column added later (a new secret, an encrypted blob) is not
 * silently pulled into memory and serialised by accident.
 */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  private static readonly SELECT = {
    id: true,
    fullName: true,
    email: true,
    mobile: true,
    passwordHash: true,
    role: true,
    bmdcNumber: true,
    avatarUrl: true,
    isActive: true,
    twoFactorEnabled: true,
    emailVerifiedAt: true,
    mobileVerifiedAt: true,
    onboardingComplete: true,
    onboardingStep: true,
    failedLoginCount: true,
    lockedUntil: true,
    tokenVersion: true,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: PrismaUserRepository.SELECT,
    });
    return row ? this.toRecord(row) : null;
  }

  async findByIdentifier(identifier: string): Promise<UserRecord | null> {
    const isEmail = identifier.includes('@');
    const row = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        ...(isEmail ? { email: identifier } : { mobile: identifier }),
      },
      select: PrismaUserRepository.SELECT,
    });
    return row ? this.toRecord(row) : null;
  }

  async existsByBmdc(bmdcNumber: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { bmdcNumber, deletedAt: null } });
    return count > 0;
  }

  async existsByEmailOrMobile(email: string | null, mobile: string | null): Promise<boolean> {
    const or: Array<Record<string, string>> = [];
    if (email) or.push({ email });
    if (mobile) or.push({ mobile });
    if (or.length === 0) return false;
    const count = await this.prisma.user.count({ where: { deletedAt: null, OR: or } });
    return count > 0;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const row = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        passwordHash: input.passwordHash,
        bmdcNumber: input.bmdcNumber,
        role: input.role as never,
      },
      select: PrismaUserRepository.SELECT,
    });
    return this.toRecord(row);
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
  }

  async recordFailedLogin(userId: string): Promise<number> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    return row.failedLoginCount;
  }

  async lockUntil(userId: string, until: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lockedUntil: until } });
  }

  async markVerified(userId: string, channel: 'email' | 'mobile'): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: channel === 'email' ? { emailVerifiedAt: new Date() } : { mobileVerifiedAt: new Date() },
    });
  }

  async bumpTokenVersion(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async setActive(userId: string, isActive: boolean): Promise<void> {
    // Deactivation also bumps the token version, which is what makes the
    // "kill-switch" immediate rather than eventual.
    await this.prisma.user.update({
      where: { id: userId },
      data: isActive ? { isActive: true } : { isActive: false, tokenVersion: { increment: 1 } },
    });
  }

  async practiceIdsFor(userId: string): Promise<string[]> {
    const rows = await this.prisma.practiceMembership.findMany({
      where: { userId, isActive: true },
      select: { practiceId: true },
    });
    return rows.map((r) => r.practiceId);
  }

  private toRecord(row: {
    id: string;
    fullName: string;
    email: string | null;
    mobile: string | null;
    passwordHash: string;
    role: string;
    bmdcNumber: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    twoFactorEnabled: boolean;
    emailVerifiedAt: Date | null;
    mobileVerifiedAt: Date | null;
    onboardingComplete: boolean;
    onboardingStep: number;
    failedLoginCount: number;
    lockedUntil: Date | null;
    tokenVersion: number;
  }): UserRecord {
    return { ...row, role: row.role as UserRole };
  }
}
