import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DirectoryAccountRepository,
  DirectoryIdentity,
  DirectoryRoleName,
  NewAccount,
  NewVerification,
  Row,
} from '../../../core/ports/directory.ports';
import { DirectoryError } from '../../../modules/directory/domain/errors';
import { uniqueViolationFields } from './prisma-errors';

const accountConflict = (error: unknown): DirectoryError | null => {
  const fields = uniqueViolationFields(error);
  if (!fields) return null;
  if (fields.includes('email')) {
    return new DirectoryError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'An account with this email already exists');
  }
  if (fields.includes('mobile')) {
    return new DirectoryError(HttpStatus.CONFLICT, 'PHONE_TAKEN', 'This mobile number is already registered');
  }
  return null;
};

@Injectable()
export class PrismaDirectoryAccountRepository implements DirectoryAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadIdentity(userId: string): Promise<DirectoryIdentity | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        directoryRoles: { select: { role: true } },
        patientAccount: { select: { id: true } },
        doctorListing: { select: { id: true, bmdcVerifiedAt: true } },
      },
    });
    if (!user) return null;
    return {
      userId: user.id,
      name: user.fullName,
      email: user.email,
      mobile: user.mobile,
      roles: user.directoryRoles.map((r) => r.role.toLowerCase() as DirectoryRoleName),
      patientId: user.patientAccount?.id ?? null,
      doctorId: user.doctorListing?.id ?? null,
      doctorVerified: Boolean(user.doctorListing?.bmdcVerifiedAt),
    };
  }

  async createPatient(account: NewAccount) {
    return this.createUser(account, {
      directoryRoles: { create: { role: 'PATIENT' } },
      patientAccount: { create: { name: account.name } },
    });
  }

  async createDoctorApplicant(account: NewAccount, verification: NewVerification) {
    return this.createUser(account, {
      directoryRoles: { create: { role: 'DOCTOR' } },
      doctorVerifications: { create: this.verificationData(verification) },
    });
  }

  async submitVerification(userId: string, verification: NewVerification): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.userDirectoryRole.upsert({
          where: { userId_role: { userId, role: 'DOCTOR' } },
          create: { userId, role: 'DOCTOR' },
          update: {},
        }),
        this.prisma.doctorVerification.create({ data: { userId, ...this.verificationData(verification) } }),
      ]);
    } catch (error) {
      // The partial unique index allows one pending request per account.
      if (uniqueViolationFields(error)) {
        throw new DirectoryError(HttpStatus.CONFLICT, 'VERIFICATION_PENDING', 'You already have a request awaiting review');
      }
      throw error;
    }
  }

  async latestVerification(userId: string): Promise<Row | null> {
    const row = await this.prisma.doctorVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        status: true,
        kind: true,
        bmdcNo: true,
        reviewNote: true,
        submittedAt: true,
        reviewedAt: true,
        details: true,
        doctor: { select: { name: true } },
      },
    });
    if (!row) return null;
    const { details, doctor, ...rest } = row;
    return { ...rest, listingName: doctor?.name ?? (details as Row).name ?? null };
  }

  private verificationData(verification: NewVerification) {
    return {
      doctorId: verification.doctorId,
      kind: verification.kind,
      bmdcNo: verification.bmdcNo,
      details: verification.details as Prisma.InputJsonValue,
    };
  }

  private async createUser(account: NewAccount, relations: Prisma.UserCreateInput | Row) {
    try {
      return await this.prisma.user.create({
        data: {
          fullName: account.name,
          email: account.email,
          mobile: account.mobile,
          passwordHash: account.passwordHash,
          role: 'PUBLIC_USER',
          ...(relations as Row),
        },
        select: { id: true, tokenVersion: true },
      }).then((user) => ({ userId: user.id, tokenVersion: user.tokenVersion }));
    } catch (error) {
      // Two simultaneous sign-ups can both pass the earlier check.
      throw accountConflict(error) ?? error;
    }
  }
}
