import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_DIRECTORY_REPOSITORY,
  type CatalogDirectoryRepository,
  type CatalogKind,
  type Row,
} from '../../../core/ports/directory.ports';
import { catalogEntry } from '../domain/content-rules';
import { DirectoryValidationError, dependantsExist, directoryNotFound } from '../domain/errors';
import { present } from '../domain/presenter';
import { DirectoryAudit } from './directory-audit.service';
import { DirectoryMediaService, type UploadedImage } from './media.service';

const LABEL: Record<CatalogKind, string> = { specialties: 'Specialty', symptoms: 'Symptom' };
const OPTIONS: Record<CatalogKind, { icon?: boolean; specialties?: boolean }> = {
  specialties: { icon: true },
  symptoms: { specialties: true },
};

/** Specialties and symptoms: the same operations on two catalogues. */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_DIRECTORY_REPOSITORY) private readonly catalog: CatalogDirectoryRepository,
    private readonly media: DirectoryMediaService,
    private readonly audit: DirectoryAudit,
  ) {}

  async listPublic(kind: CatalogKind) {
    return (await this.catalog.listPublic(kind)).map(present);
  }

  async listAdmin(kind: CatalogKind) {
    return (await this.catalog.listAdmin(kind)).map(present);
  }

  async create(kind: CatalogKind, body: Row, adminId: string) {
    const entry = await this.validEntry(kind, body);
    const row = await this.catalog.create(kind, entry);
    await this.audit.record(adminId, `${kind}_created`, kind, row.id, { name: row.name });
    return present(row);
  }

  async update(kind: CatalogKind, id: string, body: Row, adminId: string) {
    const entry = await this.validEntry(kind, body);
    const result = await this.catalog.update(kind, id, entry);
    if (!result) throw directoryNotFound(LABEL[kind]);
    await this.audit.record(adminId, `${kind}_updated`, kind, id, {
      renamedFrom: result.renamedFrom,
      renamedDoctors: result.renamedDoctors,
    });
    return { ...present(result.row), renamedDoctors: result.renamedDoctors };
  }

  async setHidden(kind: CatalogKind, id: string, hidden: boolean, adminId: string) {
    const row = await this.catalog.setHidden(kind, id, hidden);
    if (!row) throw directoryNotFound(LABEL[kind]);
    await this.audit.record(adminId, `${kind}_${hidden ? 'hidden' : 'shown'}`, kind, id);
    return row;
  }

  async remove(kind: CatalogKind, id: string, adminId: string) {
    const row = await this.requireRow(kind, id);
    if (kind === 'specialties') {
      const { doctors, symptoms } = await this.catalog.specialtyUsage(row.name);
      if (doctors || symptoms) {
        const parts = [
          doctors && `${doctors} doctor(s) have this specialty`,
          symptoms && `${symptoms} symptom(s) point to it`,
        ].filter(Boolean);
        throw dependantsExist(`${parts.join(' and ')}, so it can't be deleted. Move them first, or hide it instead.`);
      }
    }
    await this.catalog.delete(kind, id);
    await this.media.discard(row.image);
    await this.audit.record(adminId, `${kind}_deleted`, kind, id, { name: row.name });
    return { id };
  }

  async setImage(kind: CatalogKind, id: string, file: UploadedImage | undefined) {
    const row = await this.requireRow(kind, id);
    const image = await this.media.store(file, 'catalog-images', `${kind}-${id}`);
    await this.catalog.setImage(kind, id, image);
    await this.media.discard(row.image);
    return { photo: image };
  }

  async removeImage(kind: CatalogKind, id: string) {
    const row = await this.requireRow(kind, id);
    await this.catalog.setImage(kind, id, null);
    await this.media.discard(row.image);
    return { photo: null };
  }

  private async requireRow(kind: CatalogKind, id: string): Promise<Row> {
    const row = await this.catalog.find(kind, id);
    if (!row) throw directoryNotFound(LABEL[kind]);
    return row;
  }

  /** A symptom may only point at specialties that exist. */
  private async validEntry(kind: CatalogKind, body: Row): Promise<Row> {
    const entry = catalogEntry(body, OPTIONS[kind]);
    const names: string[] = entry.specialties ?? [];
    if (names.length) {
      const existing = await this.catalog.existingSpecialtyNames(names);
      const missing = names.filter((name) => !existing.includes(name));
      if (missing.length) throw new DirectoryValidationError(`Unknown specialty: ${missing.join(', ')}`);
    }
    return entry;
  }
}
