import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DirectoryAccountRepository,
  DirectoryIdentity,
  DirectoryRoleName,
  NewAccount,
  NewClinicOwner,
  NewVerification,
  Row,
} from '../../../core/ports/directory.ports';
import { DirectoryError } from '../../../modules/directory/domain/errors';
import { uniqueViolationFields } from './prisma-errors';

/** What a patient sees when choosing a clinic. Never staff or patient data. */
const CLINIC_SELECT = {
  id: true,
  name: true,
  specialization: true,
  address: true,
  locality: true,
  city: true,
  contactNumber: true,
} as const;

const OWNER_SELECT = { id: true, fullName: true, email: true, mobile: true, isActive: true } as const;

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
        doctorListing: { select: { id: true, bmdcVerifiedAt: true, pendingApproval: true } },
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
      // Not a linked doctor until an admin approves the sign-up.
      doctorId: user.doctorListing && !user.doctorListing.pendingApproval ? user.doctorListing.id : null,
      doctorVerified: Boolean(user.doctorListing?.bmdcVerifiedAt),
    };
  }

  async createPatient(account: NewAccount) {
    return this.createUser(account, {
      directoryRoles: { create: { role: 'PATIENT' } },
      patientAccount: { create: { name: account.name } },
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

  listClinics(): Promise<Row[]> {
    return this.prisma.practice.findMany({
      where: { isActive: true, deletedAt: null },
      select: CLINIC_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async clinicExists(practiceId: string): Promise<boolean> {
    const count = await this.prisma.practice.count({ where: { id: practiceId, isActive: true, deletedAt: null } });
    return count > 0;
  }

  async listPatientClinics(accountId: string): Promise<Row[]> {
    const rows = await this.prisma.patient.findMany({
      where: { accountId, deletedAt: null },
      select: { curaId: true, practice: { select: CLINIC_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ curaId, practice }) => ({ ...practice, curaId }));
  }

  async findPatientClinic(accountId: string, practiceId: string): Promise<Row | null> {
    const row = await this.prisma.patient.findFirst({
      where: { accountId, practiceId, deletedAt: null },
      select: { curaId: true, practice: { select: CLINIC_SELECT } },
    });
    return row ? { ...row.practice, curaId: row.curaId } : null;
  }

  /** The clinic keeps its record of past care; only the link to the account ends. */
  async leaveClinic(accountId: string, practiceId: string): Promise<boolean> {
    const { count } = await this.prisma.patient.updateMany({
      where: { accountId, practiceId },
      data: { accountId: null },
    });
    return count > 0;
  }

  async createClinicOwner(input: NewClinicOwner): Promise<Row> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const clinic = await tx.practice.create({
          data: { name: input.clinicName, contactNumber: input.mobile },
          select: { id: true, name: true },
        });
        const owner = await tx.user.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            mobile: input.mobile,
            passwordHash: input.passwordHash,
            role: 'ADMINISTRATOR',
            onboardingComplete: true,
            memberships: { create: { practiceId: clinic.id, role: 'ADMINISTRATOR' } },
          },
          select: OWNER_SELECT,
        });
        return { ...owner, clinics: [clinic] };
      });
    } catch (error) {
      throw accountConflict(error) ?? error;
    }
  }

  async listClinicOwners(): Promise<Row[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: 'ADMINISTRATOR', deletedAt: null },
      select: {
        ...OWNER_SELECT,
        memberships: { select: { practice: { select: { id: true, name: true } } } },
        directoryRoles: { select: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ memberships, directoryRoles, ...owner }) => ({
      ...owner,
      clinics: memberships.map((m) => m.practice),
      roles: directoryRoles.map((r) => r.role.toLowerCase()),
    }));
  }

  async findUserIdByIdentifier(identifier: string): Promise<string | null> {
    const row = await this.prisma.user.findFirst({
      where: { deletedAt: null, ...(identifier.includes('@') ? { email: identifier } : { mobile: identifier }) },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async grantRole(userId: string, role: 'AMBULANCE_OWNER' | 'PHARMACY_OWNER'): Promise<void> {
    await this.prisma.userDirectoryRole.upsert({
      where: { userId_role: { userId, role } },
      create: { userId, role },
      update: {},
    });
  }

  async revokeRole(userId: string, role: 'AMBULANCE_OWNER' | 'PHARMACY_OWNER'): Promise<void> {
    await this.prisma.userDirectoryRole.deleteMany({ where: { userId, role } });
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
