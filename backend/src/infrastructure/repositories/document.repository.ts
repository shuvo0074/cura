import { Injectable } from '@nestjs/common';
import type { DocumentCategory } from '@cura/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { DocumentRecord, DocumentRepository } from '../../core/ports/repositories';

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
}
