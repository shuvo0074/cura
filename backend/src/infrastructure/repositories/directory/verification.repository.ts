import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DoctorVerificationRepository, Row } from '../../../core/ports/directory.ports';
import { withDoctorPrefix } from '../../../modules/directory/domain/account-rules';
import { DirectoryError, directoryNotFound } from '../../../modules/directory/domain/errors';

const TAKEN_NOTE =
  'Another account was verified as the owner of this profile. If this is your profile, contact support.';

@Injectable()
export class PrismaDoctorVerificationRepository implements DoctorVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<Row[]> {
    const rows = await this.prisma.doctorVerification.findMany({
      where: { status },
      orderBy: status === 'PENDING' ? { submittedAt: 'asc' } : { reviewedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        kind: true,
        status: true,
        bmdcNo: true,
        details: true,
        reviewNote: true,
        submittedAt: true,
        reviewedAt: true,
        user: { select: { id: true, email: true, mobile: true, fullName: true } },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            photo: true,
            bmdcNo: true,
            userId: true,
            hospital: { select: { name: true } },
          },
        },
        reviewer: { select: { fullName: true } },
      },
    });
    return rows.map(({ user, doctor, reviewer, ...row }) => ({
      ...row,
      userId: user.id,
      email: user.email,
      mobile: user.mobile,
      accountName: user.fullName,
      doctorId: doctor?.id ?? null,
      listingName: doctor?.name ?? null,
      listingSpecialty: doctor?.specialty ?? null,
      listingPhoto: doctor?.photo ?? null,
      listingBmdcNo: doctor?.bmdcNo ?? null,
      listingUserId: doctor?.userId ?? null,
      listingHospital: doctor?.hospital?.name ?? null,
      reviewedByName: reviewer?.fullName ?? null,
    }));
  }

  /** Links the account to its listing and stamps the badge, all or nothing. */
  approve(id: string, reviewerId: string): Promise<{ doctorId: string; userId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM doctor_verifications WHERE id = ${id}::uuid AND status = 'PENDING' FOR UPDATE`;
      if (!locked[0]) throw directoryNotFound('Pending request');
      const request = await tx.doctorVerification.findUniqueOrThrow({ where: { id } });

      const linked = await tx.doctorListing.findUnique({ where: { userId: request.userId }, select: { id: true } });
      if (linked) {
        throw new DirectoryError(HttpStatus.CONFLICT, 'ALREADY_LINKED', 'This account already manages a doctor profile');
      }

      const doctorId =
        request.kind === 'CLAIM' && request.doctorId
          ? await this.linkClaim(tx, request.doctorId, request.userId, request.bmdcNo)
          : await this.createListing(tx, request.userId, request.bmdcNo, request.details as Row);

      await this.copyDegrees(tx, doctorId, (request.details as Row).degrees);

      const now = new Date();
      await tx.doctorVerification.update({
        where: { id },
        data: { status: 'APPROVED', doctorId, reviewedAt: now, reviewedBy: reviewerId },
      });
      // Other pending requests for this listing or this number can no longer succeed.
      await tx.doctorVerification.updateMany({
        where: { status: 'PENDING', OR: [{ doctorId }, { bmdcNo: request.bmdcNo }] },
        data: { status: 'REJECTED', reviewedAt: now, reviewedBy: reviewerId, reviewNote: TAKEN_NOTE },
      });
      return { doctorId, userId: request.userId };
    });
  }

  async reject(id: string, note: string, reviewerId: string): Promise<{ userId: string } | null> {
    const row = await this.prisma.doctorVerification.findFirst({ where: { id, status: 'PENDING' }, select: { userId: true } });
    if (!row) return null;
    const { count } = await this.prisma.doctorVerification.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', reviewNote: note, reviewedAt: new Date(), reviewedBy: reviewerId },
    });
    return count ? row : null;
  }

  private async linkClaim(tx: Prisma.TransactionClient, doctorId: string, userId: string, bmdcNo: string) {
    const locked = await tx.$queryRaw<{ userId: string | null }[]>`
      SELECT "userId" FROM doctor_listings WHERE id = ${doctorId}::uuid FOR UPDATE`;
    if (!locked[0] || locked[0].userId) {
      throw new DirectoryError(HttpStatus.CONFLICT, 'BMDC_CLAIMED', 'Another account already manages this profile');
    }
    await tx.doctorListing.update({
      where: { id: doctorId },
      data: { userId, bmdcNo, bmdcVerifiedAt: new Date() },
    });
    return doctorId;
  }

  private async createListing(tx: Prisma.TransactionClient, userId: string, bmdcNo: string, details: Row) {
    // Two sign-ups can both ask for a new listing with one number.
    const existing = await tx.doctorListing.findUnique({ where: { bmdcNo }, select: { id: true } });
    if (existing) {
      throw new DirectoryError(HttpStatus.CONFLICT, 'BMDC_CLAIMED', 'A listing with this BMDC number already exists');
    }
    const created = await tx.doctorListing.create({
      data: {
        name: withDoctorPrefix(details.name),
        specialty: details.specialty,
        gender: details.gender ?? null,
        workplace: [details.designation, details.workplace].filter(Boolean).join(', ') || null,
        phone: details.phone ?? null,
        // Unknown until the doctor enters it; never an invented price.
        followupFees: null,
        bmdcNo,
        userId,
        bmdcVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Degrees from sign-up become qualifications, unless a listing already has them. */
  private async copyDegrees(tx: Prisma.TransactionClient, doctorId: string, degrees: unknown) {
    if (!Array.isArray(degrees) || !degrees.length) return;
    const existing = await tx.doctorProfileItem.count({ where: { doctorId, kind: 'QUALIFICATION' } });
    if (existing) return;
    // Distinct timestamps keep the order the doctor wrote them in.
    const start = Date.now();
    await tx.doctorProfileItem.createMany({
      data: (degrees as string[]).map((title, index) => ({
        doctorId,
        kind: 'QUALIFICATION' as const,
        title,
        createdAt: new Date(start + index),
      })),
    });
  }
}
