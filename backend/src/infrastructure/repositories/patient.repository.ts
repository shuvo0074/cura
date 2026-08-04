import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePatientInput,
  CursorQuery,
  Page,
  PatientRecord,
  PatientRepository,
} from '../../core/ports/repositories';

@Injectable()
export class PrismaPatientRepository implements PatientRepository {
  private static readonly SELECT = {
    id: true,
    practiceId: true,
    curaId: true,
    fullName: true,
    mobile: true,
    email: true,
    gender: true,
    dateOfBirth: true,
    bloodGroup: true,
    address: true,
    avatarUrl: true,
    profileComplete: true,
    lastVisitAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  async findById(practiceId: string, id: string): Promise<PatientRecord | null> {
    const row = await this.prisma.patient.findFirst({
      where: { id, practiceId, deletedAt: null },
      select: PrismaPatientRepository.SELECT,
    });
    return row ? this.toRecord(row) : null;
  }

  async findByCuraId(practiceId: string, curaId: string): Promise<PatientRecord | null> {
    const row = await this.prisma.patient.findFirst({
      where: { curaId, practiceId, deletedAt: null },
      select: PrismaPatientRepository.SELECT,
    });
    return row ? this.toRecord(row) : null;
  }

  async findByMobile(practiceId: string, mobile: string): Promise<PatientRecord[]> {
    const rows = await this.prisma.patient.findMany({
      where: { practiceId, mobile, deletedAt: null },
      select: PrismaPatientRepository.SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  /**
   * Universal search across name, Cura ID and mobile.
   *
   * The term is classified first so each branch hits a dedicated index instead
   * of scanning: a digit string uses the (practiceId, mobile) index, a Cura ID
   * uses the unique index, and anything else does a prefix match on the
   * normalised `searchName` column. Prefix (not `%term%`) keeps it index-backed.
   */
  async search(practiceId: string, term: string, limit: number): Promise<PatientRecord[]> {
    const trimmed = term.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (digits.length >= 4 && /^[\d\s+-]+$/.test(trimmed)) {
      const rows = await this.prisma.patient.findMany({
        where: { practiceId, deletedAt: null, mobile: { contains: digits } },
        select: PrismaPatientRepository.SELECT,
        take: limit,
        orderBy: { lastVisitAt: 'desc' },
      });
      return rows.map((r) => this.toRecord(r));
    }

    if (/^CURA-/i.test(trimmed)) {
      const row = await this.findByCuraId(practiceId, trimmed.toUpperCase());
      return row ? [row] : [];
    }

    const normalised = this.normalise(trimmed);
    const rows = await this.prisma.patient.findMany({
      where: { practiceId, deletedAt: null, searchName: { startsWith: normalised } },
      select: PrismaPatientRepository.SELECT,
      take: limit,
      orderBy: { lastVisitAt: 'desc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  /** Keyset pagination — stable and O(1) regardless of page depth. */
  async list(practiceId: string, query: CursorQuery): Promise<Page<PatientRecord>> {
    const rows = await this.prisma.patient.findMany({
      where: { practiceId, deletedAt: null },
      select: PrismaPatientRepository.SELECT,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ lastVisitAt: 'desc' }, { id: 'desc' }],
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((r) => this.toRecord(r)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async create(input: CreatePatientInput): Promise<PatientRecord> {
    const sequence = await this.nextCuraSequence();
    const row = await this.prisma.patient.create({
      data: {
        practiceId: input.practiceId,
        curaId: `CURA-${String(sequence).padStart(5, '0')}`,
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email ?? null,
        gender: (input.gender ?? null) as never,
        dateOfBirth: input.dateOfBirth ?? null,
        bloodGroup: input.bloodGroup ?? null,
        address: input.address ?? null,
        searchName: this.normalise(input.fullName),
        profileComplete: this.isComplete(input),
      },
      select: PrismaPatientRepository.SELECT,
    });
    return this.toRecord(row);
  }

  async update(
    practiceId: string,
    id: string,
    patch: Partial<CreatePatientInput>,
  ): Promise<PatientRecord> {
    const row = await this.prisma.patient.update({
      where: { id },
      data: {
        ...(patch.fullName
          ? { fullName: patch.fullName, searchName: this.normalise(patch.fullName) }
          : {}),
        ...(patch.mobile ? { mobile: patch.mobile } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.gender !== undefined ? { gender: patch.gender as never } : {}),
        ...(patch.dateOfBirth !== undefined ? { dateOfBirth: patch.dateOfBirth } : {}),
        ...(patch.bloodGroup !== undefined ? { bloodGroup: patch.bloodGroup } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
      },
      select: PrismaPatientRepository.SELECT,
    });
    void practiceId;
    return this.toRecord(row);
  }

  async touchLastVisit(id: string, at: Date): Promise<void> {
    await this.prisma.patient.update({ where: { id }, data: { lastVisitAt: at } });
  }

  /**
   * Monotonic Cura ID sequence backed by a Postgres sequence rather than
   * `count() + 1`, which would race under concurrent intake.
   */
  async nextCuraSequence(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ nextval: bigint }>>(
      Prisma.sql`SELECT nextval('cura_patient_seq') AS nextval`,
    );
    return Number(rows[0]?.nextval ?? 1);
  }

  private isComplete(input: CreatePatientInput): boolean {
    return Boolean(input.fullName && input.mobile && input.gender && (input.dateOfBirth || input.address));
  }

  /** Lower-cased, punctuation-stripped form used by the prefix index. */
  private normalise(value: string): string {
    return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ');
  }

  private toRecord(row: {
    id: string;
    practiceId: string;
    curaId: string;
    fullName: string;
    mobile: string;
    email: string | null;
    gender: string | null;
    dateOfBirth: Date | null;
    bloodGroup: string | null;
    address: string | null;
    avatarUrl: string | null;
    profileComplete: boolean;
    lastVisitAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PatientRecord {
    return row;
  }
}
