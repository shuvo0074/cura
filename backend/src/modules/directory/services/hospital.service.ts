import { Inject, Injectable } from '@nestjs/common';
import {
  DOCTOR_LISTING_REPOSITORY,
  HOSPITAL_REPOSITORY,
  SITE_SETTINGS_REPOSITORY,
  type DoctorListingRepository,
  type HospitalRepository,
  type Row,
  type SiteSettingsRepository,
} from '../../../core/ports/directory.ports';
import { adminHospital } from '../domain/content-rules';
import { dependantsExist, directoryNotFound } from '../domain/errors';
import { present, presentListing } from '../domain/presenter';
import { withSampleTestPrices, type TestPrice } from '../domain/pricing';
import { scheduleEntries } from '../domain/schedule';
import { DirectoryAudit } from './directory-audit.service';
import { DirectoryMediaService, type UploadedImage } from './media.service';

/** Hospitals and diagnostic centres: public pages and admin edits. */
@Injectable()
export class HospitalService {
  constructor(
    @Inject(HOSPITAL_REPOSITORY) private readonly hospitals: HospitalRepository,
    @Inject(DOCTOR_LISTING_REPOSITORY) private readonly listings: DoctorListingRepository,
    @Inject(SITE_SETTINGS_REPOSITORY) private readonly settings: SiteSettingsRepository,
    private readonly media: DirectoryMediaService,
    private readonly audit: DirectoryAudit,
  ) {}

  async listPublic() {
    const [rows, sample] = await Promise.all([this.hospitals.listPublic(), this.activeSample()]);
    return rows.map((row) => withSampleTestPrices(present(row), sample));
  }

  async getPublic(id: string) {
    const row = await this.hospitals.findPublic(id);
    if (!row) throw directoryNotFound('Hospital');
    return withSampleTestPrices(present(row), await this.activeSample());
  }

  /** Everyone who does duty here: by hospital id or by a schedule entry. */
  async doctors(id: string) {
    const hospital = await this.hospitals.findPublic(id);
    if (!hospital) throw directoryNotFound('Hospital');
    const rows = await this.listings.listForHospital(id, hospital.name);
    return rows.map(({ weeklySchedule, ...row }) => {
      const entries = scheduleEntries(weeklySchedule).filter(
        (entry) => entry.venue === hospital.name || entry.hospital_id === id,
      );
      return { ...presentListing(row), venue_schedule: entries.length ? entries : null };
    });
  }

  async listAdmin() {
    return (await this.hospitals.listAdmin()).map(present);
  }

  async getAdmin(id: string) {
    const row = await this.hospitals.findAny(id);
    if (!row) throw directoryNotFound('Hospital');
    return present(row);
  }

  async create(body: Row, adminId: string) {
    const row = await this.hospitals.create(adminHospital(body));
    await this.audit.record(adminId, 'hospital_created', 'hospital', row.id);
    return present(row);
  }

  async update(id: string, body: Row, adminId: string) {
    const row = await this.hospitals.update(id, adminHospital(body));
    if (!row) throw directoryNotFound('Hospital');
    await this.audit.record(adminId, 'hospital_updated', 'hospital', id);
    return present(row);
  }

  async setHidden(id: string, hidden: boolean, adminId: string) {
    const row = await this.hospitals.setHidden(id, hidden);
    if (!row) throw directoryNotFound('Hospital');
    await this.audit.record(adminId, hidden ? 'hospital_hidden' : 'hospital_shown', 'hospital', id);
    return row;
  }

  async remove(id: string, adminId: string) {
    const hospital = await this.hospitals.findAny(id);
    if (!hospital) throw directoryNotFound('Hospital');
    const doctors = await this.hospitals.dependentDoctorCount(id, hospital.name);
    if (doctors) {
      throw dependantsExist(`${doctors} doctor(s) list this place as their hospital or a chamber, so it can't be deleted. Hide it instead.`);
    }
    await this.hospitals.delete(id);
    await this.media.discard(hospital.photo);
    await this.audit.record(adminId, 'hospital_deleted', 'hospital', id, { name: hospital.name });
    return { id };
  }

  async setPhoto(id: string, file: UploadedImage | undefined) {
    const photo = await this.media.store(file, 'hospital-photos', `hospital-upload-${id}`);
    const previous = await this.hospitals.setPhoto(id, photo);
    if (previous === undefined) {
      await this.media.discard(photo);
      throw directoryNotFound('Hospital');
    }
    await this.media.discard(previous);
    return { photo };
  }

  async removePhoto(id: string) {
    const previous = await this.hospitals.setPhoto(id, null);
    if (previous === undefined) throw directoryNotFound('Hospital');
    await this.media.discard(previous);
    return { photo: null };
  }

  /** The list that fills unknown prices, or null when samples are switched off. */
  private async activeSample(): Promise<TestPrice[] | null> {
    const values = await this.settings.getMany(['sample_test_prices', 'show_sample_test_prices']);
    if (values.show_sample_test_prices === false) return null;
    return (values.sample_test_prices as TestPrice[] | undefined) ?? [];
  }
}
