import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminUsersRepository, ClinicRole, GrantableRole, Row } from '../../../core/ports/directory.ports';
import { toNationalPhone, withDoctorPrefix } from '../../../modules/directory/domain/account-rules';
import { DirectoryError } from '../../../modules/directory/domain/errors';
import { HttpStatus } from '@nestjs/common';
import { orNull, uniqueViolationFields } from './prisma-errors';

/** Account fields a super admin sees. Never a password hash or token version. */
const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  mobile: true,
  role: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
  directoryRoles: { select: { role: true } },
  memberships: { select: { role: true, isActive: true, practice: { select: { id: true, name: true } } } },
} as const;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const CLINIC_SELECT = {
  id: true,
  name: true,
  specialization: true,
  contactNumber: true,
  email: true,
  address: true,
  city: true,
  isActive: true,
  createdAt: true,
  _count: { select: { memberships: true, patients: true } },
} as const;

const conflict = (error: unknown): DirectoryError | null => {
  const fields = uniqueViolationFields(error);
  if (fields?.includes('email')) return new DirectoryError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'An account with this email already exists');
  if (fields?.includes('mobile')) return new DirectoryError(HttpStatus.CONFLICT, 'PHONE_TAKEN', 'This mobile number is already registered');
  return null;
};

@Injectable()
export class PrismaAdminUsersRepository implements AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private shape(user: UserRow, hasLogin: boolean): Row {
    return {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      mobile: user.mobile,
      clinic_role: user.role === 'PUBLIC_USER' ? null : user.role,
      roles: user.directoryRoles.map((r) => r.role.toLowerCase()),
      clinics: user.memberships.map((m) => ({ id: m.practice.id, name: m.practice.name, role: m.role, is_active: m.isActive })),
      is_active: user.isActive,
      has_login: hasLogin,
      created_at: user.createdAt,
      last_login_at: user.lastLoginAt,
    };
  }

  async listUsers({ q, role, page, limit }: { q: string; role: string | null; page: number; limit: number }) {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q.replace(/^0/, '') } },
      ];
    }
    if (role) {
      if (['ADMINISTRATOR', 'DOCTOR', 'DESK_STAFF'].includes(role)) where.role = role as never;
      else where.directoryRoles = { some: { role: role as never } };
    }
    const [rows, total, logins] = await Promise.all([
      this.prisma.user.findMany({ where, select: USER_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where: { ...where, passwordHash: null }, select: { id: true } }),
    ]);
    const noLogin = new Set(logins.map((row) => row.id));
    return { items: rows.map((row) => this.shape(row, !noLogin.has(row.id))), total };
  }

  async getUser(id: string): Promise<Row | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...USER_SELECT,
        passwordHash: true,
        doctorListing: { select: { id: true, specialty: true, hidden: true, pendingApproval: true } },
        ownedAmbulances: { select: { id: true, name: true } },
        ownedPharmacies: { select: { id: true, name: true } },
      },
    });
    if (!user) return null;
    const { passwordHash, doctorListing, ownedAmbulances, ownedPharmacies, ...rest } = user;
    return {
      ...this.shape(rest, passwordHash !== null),
      doctor: doctorListing
        ? { id: doctorListing.id, specialty: doctorListing.specialty, hidden: doctorListing.hidden, pending_approval: doctorListing.pendingApproval }
        : null,
      ambulances: ownedAmbulances,
      pharmacies: ownedPharmacies,
    };
  }

  async createUser(data: { fullName: string; email: string | null; mobile: string | null; passwordHash: string }) {
    try {
      const user = await this.prisma.user.create({
        data: { ...data, role: 'PUBLIC_USER', onboardingComplete: true, mobileVerifiedAt: new Date() },
        select: { id: true },
      });
      return (await this.getUser(user.id))!;
    } catch (error) {
      throw conflict(error) ?? error;
    }
  }

  async updateUser(id: string, data: Row): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.user.updateMany({
          where: { id, deletedAt: null },
          data: { ...data, ...(data.isActive === false ? { tokenVersion: { increment: 1 } } : {}) },
        });
        if (!count) return false;
        if (data.isActive === false) {
          await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        // A doctor's name is one fact, shown on both front ends.
        if (data.fullName) {
          await tx.doctorListing.updateMany({ where: { userId: id }, data: { name: withDoctorPrefix(data.fullName) } });
        }
        return true;
      });
    } catch (error) {
      throw conflict(error) ?? error;
    }
  }

  async setRole(id: string, role: GrantableRole, granted: boolean): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (granted) {
        await tx.userDirectoryRole.upsert({ where: { userId_role: { userId: id, role } }, create: { userId: id, role }, update: {} });
        if (role === 'PATIENT') {
          const user = await tx.user.findUniqueOrThrow({ where: { id }, select: { fullName: true } });
          await tx.patientAccount.upsert({ where: { userId: id }, create: { userId: id, name: user.fullName }, update: {} });
        }
      } else {
        await tx.userDirectoryRole.deleteMany({ where: { userId: id, role } });
      }
      // The next request sees the new roles; an open session is ended.
      await this.endSessions(tx, id);
    });
  }

  countSuperAdmins(): Promise<number> {
    return this.prisma.userDirectoryRole.count({ where: { role: 'SUPER_ADMIN', user: { deletedAt: null, isActive: true } } });
  }

  async setClinicAccess(id: string, access: { role: ClinicRole | null; practiceIds: string[]; specialty: string | null }) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id }, select: { fullName: true, mobile: true } });
      const role = access.role;
      const practiceIds = role ? access.practiceIds : [];
      await tx.user.update({ where: { id }, data: { role: role ?? 'PUBLIC_USER', onboardingComplete: true } });
      await tx.practiceMembership.deleteMany({ where: { userId: id, practiceId: { notIn: practiceIds } } });
      for (const practiceId of practiceIds) {
        await tx.practiceMembership.upsert({
          where: { practiceId_userId: { practiceId, userId: id } },
          create: { practiceId, userId: id, role: role! },
          update: { role: role! },
        });
      }

      const listing = await tx.doctorListing.findUnique({ where: { userId: id }, select: { id: true, pendingApproval: true } });
      if (role === 'DOCTOR') {
        await tx.userDirectoryRole.upsert({ where: { userId_role: { userId: id, role: 'DOCTOR' } }, create: { userId: id, role: 'DOCTOR' }, update: {} });
        if (listing) {
          await tx.doctorListing.update({
            where: { id: listing.id },
            data: { ...(listing.pendingApproval ? {} : { hidden: false }), ...(access.specialty ? { specialty: access.specialty } : {}) },
          });
        } else {
          const clinic = practiceIds[0] ? await tx.practice.findUnique({ where: { id: practiceIds[0] }, select: { name: true, city: true } }) : null;
          await tx.doctorListing.create({
            data: {
              userId: id,
              name: withDoctorPrefix(user.fullName),
              specialty: access.specialty ?? 'General Physician',
              phone: toNationalPhone(user.mobile),
              chamber: clinic?.name ?? null,
              city: clinic?.city ?? null,
              followupFees: null,
            },
          });
        }
      } else {
        // No longer a doctor: patients stop seeing them, and the record stays for history.
        await tx.userDirectoryRole.deleteMany({ where: { userId: id, role: 'DOCTOR' } });
        if (listing) await tx.doctorListing.update({ where: { id: listing.id }, data: { hidden: true } });
      }
      await this.endSessions(tx, id);
    }, { timeout: 30_000 });
  }

  listClinics(): Promise<Row[]> {
    return this.prisma.practice
      .findMany({ where: { deletedAt: null }, select: CLINIC_SELECT, orderBy: { name: 'asc' } })
      .then((rows) => rows.map(({ _count, ...row }) => ({ ...row, staffCount: _count.memberships, patientCount: _count.patients })));
  }

  updateClinic(id: string, data: Row): Promise<Row | null> {
    return orNull(this.prisma.practice.update({ where: { id }, data: data as Prisma.PracticeUpdateInput, select: CLINIC_SELECT }));
  }

  listPharmacies(): Promise<Row[]> {
    return this.prisma.pharmacy.findMany({
      orderBy: { name: 'asc' },
      include: { owner: { select: { id: true, fullName: true, email: true } } },
    });
  }

  createPharmacy(ownerId: string, data: Row): Promise<Row> {
    return this.prisma.pharmacy.create({ data: { ...data, ownerId } as Prisma.PharmacyUncheckedCreateInput });
  }

  updatePharmacy(id: string, data: Row): Promise<Row | null> {
    return orNull(this.prisma.pharmacy.update({ where: { id }, data: data as Prisma.PharmacyUncheckedUpdateInput }));
  }

  async deletePharmacy(id: string): Promise<boolean> {
    const { count } = await this.prisma.pharmacy.deleteMany({ where: { id } });
    return count > 0;
  }

  async setPharmacyOwner(id: string, ownerId: string): Promise<boolean> {
    const { count } = await this.prisma.pharmacy.updateMany({ where: { id }, data: { ownerId } });
    return count > 0;
  }

  private async endSessions(tx: Prisma.TransactionClient, userId: string) {
    await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
