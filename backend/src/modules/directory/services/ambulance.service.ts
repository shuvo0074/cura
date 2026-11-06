import { Inject, Injectable } from '@nestjs/common';
import {
  AMBULANCE_REPOSITORY,
  SITE_SETTINGS_REPOSITORY,
  type AmbulanceRepository,
  type Row,
  type SiteSettingsRepository,
} from '../../../core/ports/directory.ports';
import { ambulanceVendor, fareRanges, sampleTestPrices } from '../domain/content-rules';
import { directoryNotFound } from '../domain/errors';
import { present } from '../domain/presenter';
import { withFares, type SampleFares } from '../domain/pricing';
import { DirectoryAudit } from './directory-audit.service';

/** Ambulance vendors and the shared sample prices. */
@Injectable()
export class AmbulanceService {
  constructor(
    @Inject(AMBULANCE_REPOSITORY) private readonly vendors: AmbulanceRepository,
    @Inject(SITE_SETTINGS_REPOSITORY) private readonly settings: SiteSettingsRepository,
    private readonly audit: DirectoryAudit,
  ) {}

  async listPublic() {
    const [rows, sampleFares] = await Promise.all([
      this.vendors.listPublic(),
      this.settings.get<SampleFares>('ambulance_sample_fares', {}),
    ]);
    // Who owns a service stays private; patients only learn whether someone answers requests on Cura.
    return rows.map(({ ownerId, ...row }) => {
      const shaped = present(row);
      return withFares({ ...shaped, slug: row.slug, categories: row.categories, requestable: Boolean(ownerId) }, sampleFares);
    });
  }

  async listAdmin() {
    return (await this.vendors.listAdmin()).map(present);
  }

  async create(body: Row, adminId: string) {
    const row = await this.vendors.create(ambulanceVendor(body));
    await this.audit.record(adminId, 'ambulance_created', 'ambulance_vendor', row.id, { name: row.name });
    return present(row);
  }

  async update(id: string, body: Row, adminId: string) {
    const row = await this.vendors.update(id, ambulanceVendor(body));
    if (!row) throw directoryNotFound('Ambulance vendor');
    await this.audit.record(adminId, 'ambulance_updated', 'ambulance_vendor', id);
    return present(row);
  }

  async listOwned(ownerId: string) {
    return (await this.vendors.listOwned(ownerId)).map(present);
  }

  /** A new vendor stays hidden from patients until a super admin shows it. */
  async createOwned(body: Row, ownerId: string) {
    const row = await this.vendors.createOwned(ownerId, ambulanceVendor(body));
    await this.audit.record(ownerId, 'ambulance_created_by_owner', 'ambulance_vendor', row.id, { name: row.name });
    return present(row);
  }

  /** An ambulance owner edits only their own vendor. */
  async updateOwned(id: string, body: Row, ownerId: string) {
    const row = await this.vendors.updateOwned(id, ownerId, ambulanceVendor(body));
    if (!row) throw directoryNotFound('Ambulance vendor');
    await this.audit.record(ownerId, 'ambulance_updated_by_owner', 'ambulance_vendor', id);
    return present(row);
  }

  async setHidden(id: string, hidden: boolean, adminId: string) {
    const row = await this.vendors.setHidden(id, hidden);
    if (!row) throw directoryNotFound('Ambulance vendor');
    await this.audit.record(adminId, hidden ? 'ambulance_hidden' : 'ambulance_shown', 'ambulance_vendor', id);
    return row;
  }

  async remove(id: string, adminId: string) {
    if (!(await this.vendors.delete(id))) throw directoryNotFound('Ambulance vendor');
    await this.audit.record(adminId, 'ambulance_deleted', 'ambulance_vendor', id);
    return { id };
  }

  async samplePrices() {
    const [ambulanceFares, testPrices, showTestPrices] = await Promise.all([
      this.settings.get('ambulance_sample_fares', {}),
      this.settings.get('sample_test_prices', []),
      this.settings.get('show_sample_test_prices', true),
    ]);
    return { ambulanceFares, testPrices, showTestPrices };
  }

  async updateSamplePrices(body: Row, adminId: string) {
    const changes: Row = {};
    if ('ambulanceFares' in body) changes.ambulance_sample_fares = fareRanges(body.ambulanceFares, undefined, true);
    if ('testPrices' in body) changes.sample_test_prices = sampleTestPrices(body.testPrices);
    if ('showTestPrices' in body) changes.show_sample_test_prices = body.showTestPrices === true;
    for (const [key, value] of Object.entries(changes)) await this.settings.set(key, value);
    await this.audit.record(adminId, 'sample_prices_updated', 'site_setting', null, { keys: Object.keys(changes) });
    return this.samplePrices();
  }
}
