import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DocumentCategory } from '@cura/shared';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DocumentFilter,
  DocumentListRow,
  DocumentRecord,
  DocumentRepository,
} from '../../core/ports/repositories';

@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  private static readonly SELECT = {
    id: true,
    ownerUserId: true,
    patientId: true,
    encounterId: true,
    category: true,
    fileName: true,
    mimeType: true,
    sizeBytes: true,
    storageKey: true,
    createdAt: true,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    ownerUserId: string | null;
    patientId: string | null;
    encounterId: string | null;
    category: DocumentCategory;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    checksum: string;
  }): Promise<{ id: string; storageKey: string }> {
    return this.prisma.documentAsset.create({
      data: { ...input, category: input.category as never },
      select: { id: true, storageKey: true },
    });
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const row = await this.prisma.documentAsset.findFirst({
      where: { id, deletedAt: null },
      select: PrismaDocumentRepository.SELECT,
    });
    return row ? (row as DocumentRecord) : null;
  }

  /**
   * Content-addressed lookup.
   *
   * Deliberately not scoped to a practice: the checksum identifies identical
   * bytes, and reusing the stored object saves disk without disclosing
   * anything — the returned row is only ever used to pick a storage key, never
   * to grant access to another practice's document record.
   */
  async findByChecksum(checksum: string): Promise<{ id: string; storageKey: string } | null> {
    return this.prisma.documentAsset.findFirst({
      where: { checksum, deletedAt: null },
      select: { id: true, storageKey: true },
    });
  }

  async listForPatient(patientId: string): Promise<DocumentRecord[]> {
    const rows = await this.prisma.documentAsset.findMany({
      where: { patientId, deletedAt: null },
      select: PrismaDocumentRepository.SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows as DocumentRecord[];
  }

  async listForOwner(ownerUserId: string): Promise<DocumentRecord[]> {
    const rows = await this.prisma.documentAsset.findMany({
      where: { ownerUserId, deletedAt: null },
      select: PrismaDocumentRepository.SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows as DocumentRecord[];
  }

  /**
   * Practice-wide browse.
   *
   * `DocumentAsset` carries no practiceId — a file belongs either to a patient
   * or to a user — so tenancy is expressed through the patient relation. The
   * caller's own profile documents are unioned in, and *only* theirs: another
   * doctor's NID scan is not practice-visible material.
   *
   * Paginated by keyset on (createdAt, id) rather than OFFSET, so a page stays
   * correct while uploads are landing.
   */
  async listForPractice(
    practiceId: string,
    filter: DocumentFilter,
  ): Promise<{ items: DocumentListRow[]; nextCursor: string | null }> {
    const term = filter.q?.trim();

    const scope: Prisma.DocumentAssetWhereInput = filter.patientId
      ? { patientId: filter.patientId, patient: { practiceId, deletedAt: null } }
      : {
          OR: [
            { patient: { practiceId, deletedAt: null } },
            { patientId: null, ownerUserId: filter.ownerUserId },
          ],
        };

    const where: Prisma.DocumentAssetWhereInput = {
      deletedAt: null,
      ...scope,
      ...(filter.category ? { category: filter.category as never } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lt: filter.to } : {}),
            },
          }
        : {}),
      ...(term
        ? {
            OR: [
              { fileName: { contains: term, mode: 'insensitive' } },
              { patient: { searchName: { contains: term.toLowerCase() } } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.documentAsset.findMany({
      where,
      select: {
        id: true,
        category: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        capturedOn: true,
        encounterId: true,
        patient: { select: { id: true, fullName: true, curaId: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // One extra row tells us whether another page exists without a COUNT.
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });

    const items = rows.slice(0, filter.limit) as DocumentListRow[];
    return {
      items,
      nextCursor: rows.length > filter.limit ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * Soft delete.
   *
   * The row is retained because the audit trail references it, and because the
   * stored object may be shared with another record through checksum
   * de-duplication — a hard delete would break an unrelated document.
   */
  async softDelete(id: string): Promise<void> {
    await this.prisma.documentAsset.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
