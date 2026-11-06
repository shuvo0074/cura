import { Inject, Injectable } from '@nestjs/common';
import { PHARMACY_REPOSITORY, type PharmacyRepository, type Row } from '../../../core/ports/directory.ports';
import { pharmacy } from '../domain/content-rules';
import { directoryNotFound } from '../domain/errors';
import { present } from '../domain/presenter';
import { DirectoryAudit } from './directory-audit.service';

/** Pharmacies on Cura Website, and a pharmacy owner's own businesses. */
@Injectable()
export class PharmacyService {
  constructor(
    @Inject(PHARMACY_REPOSITORY) private readonly pharmacies: PharmacyRepository,
    private readonly audit: DirectoryAudit,
  ) {}

  /** What patients see on Cura Website: visible pharmacies, public fields only. */
  async listPublic() {
    return (await this.pharmacies.listPublic()).map(present);
  }

  async listOwned(ownerId: string) {
    return (await this.pharmacies.listOwned(ownerId)).map(present);
  }

  /** A new pharmacy stays hidden from patients until a super admin shows it. */
  async create(body: Row, ownerId: string) {
    const row = await this.pharmacies.create(ownerId, pharmacy(body));
    await this.audit.record(ownerId, 'pharmacy_created', 'pharmacy', row.id, { name: row.name });
    return present(row);
  }

  async update(id: string, body: Row, ownerId: string) {
    const row = await this.pharmacies.update(id, ownerId, pharmacy(body));
    if (!row) throw directoryNotFound('Pharmacy');
    await this.audit.record(ownerId, 'pharmacy_updated', 'pharmacy', id);
    return present(row);
  }
}
