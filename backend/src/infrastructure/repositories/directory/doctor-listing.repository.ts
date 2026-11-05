import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DoctorListingRepository, DoctorSearch, Row } from '../../../core/ports/directory.ports';
import { DirectoryError, DirectoryValidationError } from '../../../modules/directory/domain/errors';
import { isForeignKeyViolation, orNull, uniqueViolationFields } from './prisma-errors';

const DEGREE_ITEMS = {
  where: { kind: 'QUALIFICATION' as const },
  select: { title: true, endYear: true, createdAt: true },
};

/**
 * The only columns any public response reads. Account fields are never selected,
 * so a credential or user detail cannot reach a public endpoint by accident.
 */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  gender: true,
  genderIsDemo: true,
  specialty: true,
  department: true,
  experience: true,
  chamber: true,
  fees: true,
  followupFees: true,
  workplace: true,
  city: true,
  division: true,
  hospitalId: true,
  phone: true,
  photo: true,
  rating: true,
  about: true,
  lat: true,
  lng: true,
  website: true,
  sourceUrl: true,
  verifiedOn: true,
  shareCount: true,
  bmdcNo: true,
  education: true,
  languages: true,
  consultingHours: true,
  address: true,
  clinicalExpertise: true,
  treatments: true,
  weeklySchedule: true,
  bmdcVerifiedAt: true,
  headline: true,
  slug: true,
  practicingSince: true,
  profileUpdatedAt: true,
  userId: true,
  hospital: { select: { name: true } },
  items: DEGREE_ITEMS,
} satisfies Prisma.DoctorListingSelect;

/** What a list row needs for cards and search results. */
const LIST_SELECT = {
  id: true,
  name: true,
  gender: true,
  genderIsDemo: true,
  specialty: true,
  department: true,
  experience: true,
  chamber: true,
  fees: true,
  followupFees: true,
  workplace: true,
  city: true,
  division: true,
  photo: true,
  rating: true,
  bmdcNo: true,
  bmdcVerifiedAt: true,
  education: true,
  hospital: { select: { name: true } },
  items: DEGREE_ITEMS,
} satisfies Prisma.DoctorListingSelect;

const HOSPITAL_DOCTOR_SELECT = {
  id: true,
  name: true,
  specialty: true,
  department: true,
  experience: true,
  photo: true,
  rating: true,
  fees: true,
  followupFees: true,
  workplace: true,
  chamber: true,
  sourceUrl: true,
  verifiedOn: true,
  weeklySchedule: true,
  education: true,
  items: DEGREE_ITEMS,
} satisfies Prisma.DoctorListingSelect;

/** The client-facing form of a constraint failure on a listing write, if any. */
function writeConflict(error: unknown): DirectoryError | DirectoryValidationError | null {
  if (uniqueViolationFields(error)?.includes('bmdcNo')) {
    return new DirectoryError(HttpStatus.CONFLICT, 'BMDC_CLAIMED', 'Another listing already has this BMDC number');
  }
  if (isForeignKeyViolation(error)) return new DirectoryValidationError('That hospital does not exist');
  return null;
}

@Injectable()
export class PrismaDoctorListingRepository implements DoctorListingRepository {
  constructor(private readonly prisma: PrismaService) {}

  listPublic(): Promise<Row[]> {
    return this.prisma.doctorListing.findMany({
      where: { hidden: false },
      select: PUBLIC_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async searchPublic({ q, filters, page, limit }: DoctorSearch) {
    const where: Prisma.DoctorListingWhereInput = {
      hidden: false,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { specialty: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...Object.fromEntries(Object.entries(filters).map(([column, values]) => [column, { in: values }])),
    };
    const [total, items] = await Promise.all([
      this.prisma.doctorListing.count({ where }),
      this.prisma.doctorListing.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, total };
  }

  featured(limit: number): Promise<Row[]> {
    return this.prisma.doctorListing.findMany({
      where: { hidden: false },
      select: PUBLIC_SELECT,
      orderBy: [{ rating: { sort: 'desc', nulls: 'last' } }, { shareCount: 'desc' }, { id: 'asc' }],
      take: limit,
    });
  }

  async stats(): Promise<Row> {
    const visible = { hidden: false };
    const [doctors, hospitals, withBmdc, bySpecialty, byDivision, byCity] = await Promise.all([
      this.prisma.doctorListing.count({ where: visible }),
      this.prisma.hospital.count({ where: visible }),
      this.prisma.doctorListing.count({ where: { ...visible, bmdcNo: { not: null } } }),
      this.prisma.doctorListing.groupBy({ by: ['specialty'], where: visible, _count: { _all: true } }),
      this.prisma.doctorListing.groupBy({ by: ['division'], where: { ...visible, division: { not: null } }, _count: { _all: true } }),
      this.prisma.doctorListing.groupBy({ by: ['city'], where: { ...visible, city: { not: null } }, _count: { _all: true } }),
    ]);
    const counts = (rows: Row[], key: string) => Object.fromEntries(rows.map((r) => [r[key], r._count._all]));
    return {
      doctors,
      hospitals,
      specialties: bySpecialty.length,
      divisions: byDivision.length,
      with_bmdc: withBmdc,
      bySpecialty: counts(bySpecialty, 'specialty'),
      byDivision: counts(byDivision, 'division'),
      byCity: counts(byCity, 'city'),
    };
  }

  findPublicById(id: string): Promise<Row | null> {
    return this.prisma.doctorListing.findFirst({ where: { id, hidden: false }, select: PUBLIC_SELECT });
  }

  findPublicBySlug(slug: string): Promise<Row | null> {
    return this.prisma.doctorListing.findFirst({ where: { slug, hidden: false }, select: PUBLIC_SELECT });
  }

  findVisible(id: string) {
    return this.prisma.doctorListing.findFirst({
      where: { id, hidden: false },
      select: { id: true, weeklySchedule: true, clinicalExpertise: true },
    });
  }

  findByBmdc(bmdcNo: string) {
    return this.prisma.doctorListing.findUnique({ where: { bmdcNo }, select: { id: true, userId: true } });
  }

  async listForHospital(hospitalId: string, hospitalName: string): Promise<Row[]> {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT d.id FROM doctor_listings d
      WHERE NOT d.hidden AND (d."hospitalId" = ${hospitalId}::uuid OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(d."weeklySchedule", '[]'::jsonb)) elem
        WHERE elem->>'venue' = ${hospitalName} OR elem->>'hospital_id' = ${hospitalId}))`;
    return this.prisma.doctorListing.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
      select: HOSPITAL_DOCTOR_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  listAdmin(): Promise<Row[]> {
    return this.prisma.doctorListing.findMany({
      select: { ...PUBLIC_SELECT, hidden: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async create(data: Row): Promise<Row> {
    try {
      return await this.prisma.doctorListing.create({
        data: data as Prisma.DoctorListingUncheckedCreateInput,
        select: { ...PUBLIC_SELECT, hidden: true },
      });
    } catch (error) {
      throw writeConflict(error) ?? error;
    }
  }

  async update(id: string, data: Row): Promise<Row | null> {
    try {
      return await orNull(
        this.prisma.$transaction(async (tx) => {
          const before = await tx.doctorListing.findUniqueOrThrow({
            where: { id },
            select: { bmdcNo: true, gender: true },
          });
          return tx.doctorListing.update({
            where: { id },
            data: {
              ...(data as Prisma.DoctorListingUncheckedUpdateInput),
              // The badge vouches for one number; a new number has not been checked.
              ...(before.bmdcNo !== data.bmdcNo ? { bmdcVerifiedAt: null } : {}),
              ...(before.gender !== data.gender ? { genderIsDemo: false } : {}),
            },
            select: { ...PUBLIC_SELECT, hidden: true },
          });
        }),
      );
    } catch (error) {
      throw writeConflict(error) ?? error;
    }
  }

  setHidden(id: string, hidden: boolean): Promise<Row | null> {
    return orNull(
      this.prisma.doctorListing.update({ where: { id }, data: { hidden }, select: { id: true, name: true, hidden: true } }),
    );
  }

  bookingCount(id: string): Promise<number> {
    return this.prisma.serialBooking.count({ where: { doctorId: id } });
  }

  delete(id: string) {
    return orNull(
      this.prisma.doctorListing.delete({ where: { id }, select: { id: true, name: true, photo: true } }),
    );
  }

  async setPhoto(id: string, photo: string | null): Promise<string | null | undefined> {
    const before = await this.prisma.doctorListing.findUnique({ where: { id }, select: { photo: true } });
    if (!before) return undefined;
    await this.prisma.doctorListing.update({ where: { id }, data: { photo } });
    return before.photo;
  }
}
