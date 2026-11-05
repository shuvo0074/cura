import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type ProfileItemKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DoctorProfileRepository, Row } from '../../../core/ports/directory.ports';
import { DirectoryError } from '../../../modules/directory/domain/errors';
import { orNull, uniqueViolationFields } from './prisma-errors';

const ITEM_SELECT = {
  id: true,
  kind: true,
  title: true,
  organization: true,
  location: true,
  startYear: true,
  endYear: true,
  isCurrent: true,
  url: true,
  description: true,
  createdAt: true,
} satisfies Prisma.DoctorProfileItemSelect;

/** Current roles first, then most recent; undated entries last. */
function byRecency(a: Row, b: Row): number {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
  const yearA = a.endYear ?? a.startYear ?? -1;
  const yearB = b.endYear ?? b.startYear ?? -1;
  if (yearA !== yearB) return yearB - yearA;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

const toItemData = ({ kind, ...item }: Row) => ({ ...item, ...(kind ? { kind: String(kind).toUpperCase() as ProfileItemKind } : {}) });

@Injectable()
export class PrismaDoctorProfileRepository implements DoctorProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSelf(doctorId: string): Promise<Row | null> {
    return this.prisma.doctorListing.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        name: true,
        specialty: true,
        bmdcNo: true,
        bmdcVerifiedAt: true,
        photo: true,
        headline: true,
        about: true,
        practicingSince: true,
        workplace: true,
        languages: true,
        website: true,
        fees: true,
        followupFees: true,
        clinicalExpertise: true,
        treatments: true,
        slug: true,
        profileUpdatedAt: true,
      },
    });
  }

  async assignFirstFreeSlug(doctorId: string, candidates: string[]): Promise<string | null> {
    for (const slug of candidates) {
      try {
        const { count } = await this.prisma.doctorListing.updateMany({
          where: { id: doctorId, slug: null },
          data: { slug },
        });
        if (count) return slug;
        return (await this.prisma.doctorListing.findUnique({ where: { id: doctorId }, select: { slug: true } }))?.slug ?? null;
      } catch (error) {
        if (!uniqueViolationFields(error)) throw error;
      }
    }
    return null;
  }

  async updateSelf(doctorId: string, patch: Row): Promise<void> {
    try {
      await this.prisma.doctorListing.update({
        where: { id: doctorId },
        data: { ...(patch as Prisma.DoctorListingUncheckedUpdateInput), profileUpdatedAt: new Date() },
      });
    } catch (error) {
      if (uniqueViolationFields(error)?.includes('slug')) {
        throw new DirectoryError(HttpStatus.CONFLICT, 'SLUG_TAKEN', 'That profile link is taken. Try another.');
      }
      throw error;
    }
  }

  async touch(doctorId: string): Promise<void> {
    await this.prisma.doctorListing.update({ where: { id: doctorId }, data: { profileUpdatedAt: new Date() } });
  }

  async items(doctorId: string): Promise<Row[]> {
    const rows = await this.prisma.doctorProfileItem.findMany({ where: { doctorId }, select: ITEM_SELECT });
    return rows.sort(byRecency);
  }

  countItems(doctorId: string, kind: string): Promise<number> {
    return this.prisma.doctorProfileItem.count({
      where: { doctorId, kind: kind.toUpperCase() as ProfileItemKind },
    });
  }

  addItem(doctorId: string, item: Row): Promise<Row> {
    return this.prisma.doctorProfileItem.create({
      data: { doctorId, ...toItemData(item) } as Prisma.DoctorProfileItemUncheckedCreateInput,
      select: ITEM_SELECT,
    });
  }

  async updateItem(doctorId: string, itemId: string, item: Row): Promise<Row | null> {
    const owned = await this.prisma.doctorProfileItem.findFirst({ where: { id: itemId, doctorId }, select: { id: true } });
    if (!owned) return null;
    const { kind: _kind, ...rest } = item;
    return orNull(
      this.prisma.doctorProfileItem.update({
        where: { id: itemId },
        data: rest as Prisma.DoctorProfileItemUncheckedUpdateInput,
        select: ITEM_SELECT,
      }),
    );
  }

  async deleteItem(doctorId: string, itemId: string): Promise<boolean> {
    const { count } = await this.prisma.doctorProfileItem.deleteMany({ where: { id: itemId, doctorId } });
    return count > 0;
  }

  endorsementSummaries(doctorId: string, skills: string[]): Promise<Row[]> {
    return this.prisma.doctorEndorsement.findMany({
      where: { doctorId, skill: { in: skills } },
      orderBy: { createdAt: 'desc' },
      select: {
        skill: true,
        endorserDoctorId: true,
        endorser: { select: { id: true, name: true, photo: true, specialty: true } },
      },
    });
  }

  async isVerified(doctorId: string): Promise<boolean> {
    const row = await this.prisma.doctorListing.findUnique({ where: { id: doctorId }, select: { bmdcVerifiedAt: true } });
    return Boolean(row?.bmdcVerifiedAt);
  }

  async endorse(doctorId: string, endorserId: string, skill: string): Promise<void> {
    await this.prisma.doctorEndorsement.createMany({
      data: [{ doctorId, endorserDoctorId: endorserId, skill }],
      skipDuplicates: true,
    });
  }

  async unendorse(doctorId: string, endorserId: string, skill: string): Promise<void> {
    await this.prisma.doctorEndorsement.deleteMany({ where: { doctorId, endorserDoctorId: endorserId, skill } });
  }

  async reviewSummary(doctorId: string) {
    const result = await this.prisma.doctorReview.aggregate({
      where: { doctorId, hiddenAt: null },
      _count: { _all: true },
      _avg: { rating: true },
    });
    const average = result._avg.rating;
    return { count: result._count._all, average: average === null ? null : Math.round(average * 10) / 10 };
  }

  recentReviews(doctorId: string, limit: number): Promise<Row[]> {
    return this.prisma.doctorReview.findMany({
      where: { doctorId, hiddenAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      // No patient identity on a public page.
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
  }

  async endorsementTotals(doctorId: string) {
    const rows = await this.prisma.doctorEndorsement.findMany({ where: { doctorId }, select: { endorserDoctorId: true } });
    return { recognitions: rows.length, peers: new Set(rows.map((r) => r.endorserDoctorId)).size };
  }
}
