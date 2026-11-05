import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AmbulanceRepository,
  CatalogDirectoryRepository,
  CatalogKind,
  HospitalRepository,
  Row,
  SiteSettingsRepository,
} from '../../../core/ports/directory.ports';
import { urlSlug } from '../../../modules/directory/domain/content-rules';
import { DirectoryError } from '../../../modules/directory/domain/errors';
import { orNull, uniqueViolationFields } from './prisma-errors';

const HOSPITAL_PUBLIC_LIST = {
  id: true,
  name: true,
  location: true,
  division: true,
  address: true,
  hotline: true,
  photo: true,
  lat: true,
  lng: true,
  website: true,
  doctorCount: true,
  description: true,
  type: true,
  services: true,
  beds: true,
  tests: true,
  facilities: true,
  paymentMethods: true,
  openingHours: true,
  visitingHours: true,
  sourceUrl: true,
  verifiedOn: true,
} satisfies Prisma.HospitalSelect;

/** Prisma needs an explicit marker to store SQL NULL in a JSON column. */
const withNullableJson = (data: Row, fields: string[]): Row => {
  const out = { ...data };
  for (const field of fields) if (out[field] === null) out[field] = Prisma.DbNull;
  return out;
};
const HOSPITAL_JSON = ['services', 'beds', 'tests', 'facilities', 'paymentMethods'];

const VISIBILITY = { id: true, name: true, hidden: true } as const;

@Injectable()
export class PrismaHospitalRepository implements HospitalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(): Promise<Row[]> {
    const rows = await this.prisma.hospital.findMany({
      where: { hidden: false },
      select: HOSPITAL_PUBLIC_LIST,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    // Test lists are for diagnostic centres only; others load them on their page.
    return rows.map((row) => (row.type === 'diagnostic' ? row : { ...row, tests: null }));
  }

  findPublic(id: string): Promise<Row | null> {
    return this.prisma.hospital.findFirst({ where: { id, hidden: false }, select: HOSPITAL_PUBLIC_LIST });
  }

  listAdmin(): Promise<Row[]> {
    return this.prisma.hospital.findMany({
      select: { id: true, name: true, location: true, division: true, address: true, hotline: true, photo: true, type: true, hidden: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  findAny(id: string): Promise<Row | null> {
    return this.prisma.hospital.findUnique({ where: { id } });
  }

  create(data: Row): Promise<Row> {
    return this.prisma.hospital.create({ data: withNullableJson(data, HOSPITAL_JSON) as Prisma.HospitalUncheckedCreateInput });
  }

  update(id: string, data: Row): Promise<Row | null> {
    return orNull(this.prisma.hospital.update({ where: { id }, data: withNullableJson(data, HOSPITAL_JSON) as Prisma.HospitalUncheckedUpdateInput }));
  }

  setHidden(id: string, hidden: boolean): Promise<Row | null> {
    return orNull(this.prisma.hospital.update({ where: { id }, data: { hidden }, select: VISIBILITY }));
  }

  async dependentDoctorCount(id: string, name: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM doctor_listings d
      WHERE d."hospitalId" = ${id}::uuid OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(d."weeklySchedule", '[]'::jsonb)) elem
        WHERE elem->>'venue' = ${name} OR elem->>'hospital_id' = ${id})`;
    return rows[0]?.count ?? 0;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.hospital.delete({ where: { id } });
  }

  async setPhoto(id: string, photo: string | null): Promise<string | null | undefined> {
    const before = await this.prisma.hospital.findUnique({ where: { id }, select: { photo: true } });
    if (!before) return undefined;
    await this.prisma.hospital.update({ where: { id }, data: { photo } });
    return before.photo;
  }
}

@Injectable()
export class PrismaAmbulanceRepository implements AmbulanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  listPublic(): Promise<Row[]> {
    return this.prisma.ambulanceVendor.findMany({ where: { hidden: false }, orderBy: { name: 'asc' } });
  }

  listAdmin(): Promise<Row[]> {
    return this.prisma.ambulanceVendor.findMany({ orderBy: { name: 'asc' } });
  }

  async create(data: Row): Promise<Row> {
    const base = urlSlug(data.name) || 'ambulance';
    const taken = await this.prisma.ambulanceVendor.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    return this.prisma.ambulanceVendor.create({
      data: { ...data, slug: freeSlug(base, taken.map((row) => row.slug)) } as Prisma.AmbulanceVendorUncheckedCreateInput,
    });
  }

  update(id: string, data: Row): Promise<Row | null> {
    return orNull(this.prisma.ambulanceVendor.update({ where: { id }, data: data as Prisma.AmbulanceVendorUncheckedUpdateInput }));
  }

  setHidden(id: string, hidden: boolean): Promise<Row | null> {
    return orNull(this.prisma.ambulanceVendor.update({ where: { id }, data: { hidden }, select: VISIBILITY }));
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.ambulanceVendor.deleteMany({ where: { id } });
    return count > 0;
  }
}

function freeSlug(base: string, taken: string[]): string {
  const used = new Set(taken);
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

const duplicateName = (kind: CatalogKind) =>
  new DirectoryError(
    HttpStatus.CONFLICT,
    'NAME_TAKEN',
    `Another ${kind === 'specialties' ? 'specialty' : 'symptom'} already has this name`,
  );

@Injectable()
export class PrismaCatalogDirectoryRepository implements CatalogDirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Both tables share the operations used here; the kind selects the delegate. */
  private table(kind: CatalogKind, client: Prisma.TransactionClient | PrismaService = this.prisma): any {
    return kind === 'specialties' ? client.specialty : client.symptom;
  }

  async listPublic(kind: CatalogKind): Promise<Row[]> {
    const rows: Row[] = await this.table(kind).findMany({ where: { hidden: false }, orderBy: { name: 'asc' } });
    return rows.map(({ hidden: _hidden, ...row }) => row);
  }

  async listAdmin(kind: CatalogKind): Promise<Row[]> {
    const rows: Row[] = await this.table(kind).findMany({ orderBy: { name: 'asc' } });
    if (kind !== 'specialties') return rows;
    const counts = await this.prisma.doctorListing.groupBy({ by: ['specialty'], _count: { _all: true } });
    const byName = new Map(counts.map((c) => [c.specialty, c._count._all]));
    return rows.map((row) => ({ ...row, doctorCount: byName.get(row.name) ?? 0 }));
  }

  find(kind: CatalogKind, id: string): Promise<Row | null> {
    return this.table(kind).findUnique({ where: { id } });
  }

  async create(kind: CatalogKind, data: Row): Promise<Row> {
    const base = urlSlug(data.name) || kind.slice(0, -1);
    const taken: { slug: string }[] = await this.table(kind).findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    try {
      return await this.table(kind).create({ data: { ...data, slug: freeSlug(base, taken.map((row) => row.slug)) } });
    } catch (error) {
      if (uniqueViolationFields(error)) throw duplicateName(kind);
      throw error;
    }
  }

  async update(kind: CatalogKind, id: string, data: Row) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before: { name: string } | null = await this.table(kind, tx).findUnique({
          where: { id },
          select: { name: true },
        });
        if (!before) return null;
        const row: Row = await this.table(kind, tx).update({ where: { id }, data });
        let renamedDoctors = 0;
        const renamed = before.name !== data.name;
        if (kind === 'specialties' && renamed) {
          ({ count: renamedDoctors } = await tx.doctorListing.updateMany({
            where: { specialty: before.name },
            data: { specialty: data.name },
          }));
          await tx.$executeRaw`
            UPDATE symptoms SET specialties = (
              SELECT jsonb_agg(CASE WHEN s = to_jsonb(${before.name}::text) THEN to_jsonb(${data.name}::text) ELSE s END)
              FROM jsonb_array_elements(specialties) s)
            WHERE specialties @> to_jsonb(ARRAY[${before.name}::text])`;
        }
        return { row, renamedDoctors, renamedFrom: renamed ? before.name : null };
      });
    } catch (error) {
      if (uniqueViolationFields(error)) throw duplicateName(kind);
      throw error;
    }
  }

  setHidden(kind: CatalogKind, id: string, hidden: boolean): Promise<Row | null> {
    return orNull(this.table(kind).update({ where: { id }, data: { hidden }, select: VISIBILITY }));
  }

  async delete(kind: CatalogKind, id: string): Promise<void> {
    await this.table(kind).delete({ where: { id } });
  }

  async setImage(kind: CatalogKind, id: string, image: string | null): Promise<void> {
    await this.table(kind).update({ where: { id }, data: { image } });
  }

  async specialtyUsage(name: string) {
    const [doctors, symptomRows] = await Promise.all([
      this.prisma.doctorListing.count({ where: { specialty: name } }),
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM symptoms WHERE specialties @> to_jsonb(ARRAY[${name}::text])`,
    ]);
    return { doctors, symptoms: symptomRows[0]?.count ?? 0 };
  }

  async ensureSpecialty(name: string): Promise<void> {
    const existing = await this.prisma.specialty.findUnique({ where: { name }, select: { id: true } });
    if (existing) return;
    const base = urlSlug(name) || 'specialty';
    const taken = await this.prisma.specialty.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
    await this.prisma.specialty.createMany({
      data: [{ slug: freeSlug(base, taken.map((row) => row.slug)), name, hidden: true }],
      skipDuplicates: true,
    });
  }

  async existingSpecialtyNames(names: string[]): Promise<string[]> {
    const rows = await this.prisma.specialty.findMany({ where: { name: { in: names } }, select: { name: true } });
    return rows.map((row) => row.name);
  }

  async slugs(kind: CatalogKind): Promise<string[]> {
    const rows: { slug: string }[] = await this.table(kind).findMany({ select: { slug: true } });
    return rows.map((row) => row.slug);
  }
}

@Injectable()
export class PrismaSiteSettingsRepository implements SiteSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const rows = await this.prisma.siteSetting.findMany({ where: { key: { in: keys } } });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async set(key: string, value: unknown): Promise<void> {
    const json = value as Prisma.InputJsonValue;
    await this.prisma.siteSetting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
  }
}
