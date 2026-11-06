import { Injectable } from '@nestjs/common';
import type { OwnerRole, UserRole } from '@cura/shared';
import { ConflictError } from '../../common/errors/domain-error';
import { withDoctorPrefix, toNationalPhone } from '../../modules/directory/domain/account-rules';
import { uniqueViolationFields } from './directory/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ClaimableDoctor,
  CreateUserInput,
  DoctorApplicantInput,
  UserProfilePatch,
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

  /** The user, their doctor record and their approval request, all or nothing. */
  async createDoctorApplicant(input: DoctorApplicantInput): Promise<UserRecord> {
    try {
      const row = await this.prisma.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          mobile: input.mobile,
          passwordHash: input.passwordHash,
          role: 'DOCTOR',
          directoryRoles: { create: { role: 'DOCTOR' } },
          doctorListing: {
            create: {
              name: withDoctorPrefix(input.fullName),
              specialty: input.specialty,
              phone: toNationalPhone(input.mobile),
              followupFees: null,
              hidden: true,
              pendingApproval: true,
            },
          },
          doctorVerifications: {
            create: {
              kind: 'NEW',
              bmdcNo: input.bmdcNo,
              details: { name: input.fullName, specialty: input.specialty, phone: toNationalPhone(input.mobile) },
            },
          },
        },
        select: PrismaUserRepository.SELECT,
      });
      return this.toRecord(row);
    } catch (error) {
      if (uniqueViolationFields(error)) {
        throw new ConflictError('ACCOUNT_EXISTS', 'An account already exists with those contact details.');
      }
      throw error;
    }
  }

  async findClaimableDoctor(mobile: string): Promise<ClaimableDoctor | null> {
    const row = await this.prisma.user.findFirst({
      where: { mobile, role: 'DOCTOR', passwordHash: null, isActive: true, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        mobile: true,
        doctorListing: { select: { specialty: true, bmdcNo: true } },
      },
    });
    if (!row?.mobile || !row.doctorListing) return null;
    return {
      userId: row.id,
      fullName: row.fullName,
      mobile: row.mobile,
      specialty: row.doctorListing.specialty,
      bmdcNo: row.doctorListing.bmdcNo,
    };
  }

  async bmdcTakenByOther(bmdcNo: string, userId: string | null): Promise<boolean> {
    const others = userId ? { userId: { not: userId } } : {};
    const listing = await this.prisma.doctorListing.count({ where: { bmdcNo, ...others } });
    if (listing) return true;
    const account = await this.prisma.user.count({
      where: { bmdcNumber: bmdcNo, deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
    });
    return account > 0;
  }

  async completeDoctorClaim(
    userId: string,
    input: { passwordHash: string; bmdcNo: string; email: string | null },
  ): Promise<UserRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Conditional, so two people finishing at once cannot both set a password.
        const { count } = await tx.user.updateMany({
          where: { id: userId, passwordHash: null },
          data: {
            passwordHash: input.passwordHash,
            bmdcNumber: input.bmdcNo,
            mobileVerifiedAt: new Date(),
            onboardingComplete: true,
            ...(input.email ? { email: input.email } : {}),
          },
        });
        if (!count) return null;
        await tx.doctorListing.update({ where: { userId }, data: { bmdcNo: input.bmdcNo } });
        const row = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: PrismaUserRepository.SELECT,
        });
        return this.toRecord(row);
      });
    } catch (error) {
      if (uniqueViolationFields(error)) {
        throw new ConflictError('ACCOUNT_EXISTS', 'That email or BMDC number is already in use.');
      }
      throw error;
    }
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
    if (isActive) {
      await this.prisma.user.update({ where: { id: userId }, data: { isActive: true } });
      return;
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /**
   * A password change ends every existing session.
   *
   * Bumping the token version is the whole point: if the change was prompted by
   * a suspected compromise, leaving the attacker's issued tokens valid until
   * expiry defeats the exercise.
   */
  async setPassword(userId: string, passwordHash: string): Promise<void> {
    // Refresh tokens go too: rotation mints with the current version, so a stolen
    // cookie would otherwise outlive the password it was stolen under.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async setTwoFactorEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: enabled },
    });
  }

  async updateProfile(userId: string, patch: UserProfilePatch): Promise<UserRecord> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: patch as never,
      select: PrismaUserRepository.SELECT,
    });
    // A doctor's name is one fact, shown on both front ends.
    if (patch.fullName) {
      await this.prisma.doctorListing.updateMany({
        where: { userId },
        data: { name: withDoctorPrefix(patch.fullName) },
      });
    }
    return this.toRecord(row);
  }

  async ownerRolesFor(userId: string): Promise<OwnerRole[]> {
    const rows = await this.prisma.userDirectoryRole.findMany({
      where: { userId, role: { in: ['AMBULANCE_OWNER', 'PHARMACY_OWNER', 'HOSPITAL_OWNER'] } },
      select: { role: true },
    });
    return rows.map((row) => row.role.toLowerCase() as OwnerRole);
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const count = await this.prisma.userDirectoryRole.count({ where: { userId, role: 'SUPER_ADMIN' } });
    return count > 0;
  }

  async allPracticeIds(): Promise<string[]> {
    const rows = await this.prisma.practice.findMany({ where: { deletedAt: null }, select: { id: true } });
    return rows.map((row) => row.id);
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
    passwordHash: string | null;
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
