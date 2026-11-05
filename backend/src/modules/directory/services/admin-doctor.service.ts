import { Inject, Injectable } from '@nestjs/common';
import { bdMobileSchema } from '@cura/shared';
import {
  CATALOG_DIRECTORY_REPOSITORY,
  DOCTOR_LISTING_REPOSITORY,
  type CatalogDirectoryRepository,
  type DoctorListingRepository,
  type Row,
} from '../../../core/ports/directory.ports';
import { toNationalPhone, withDoctorPrefix } from '../domain/account-rules';
import { adminDoctor, weeklySchedule } from '../domain/content-rules';
import { DirectoryValidationError, dependantsExist, directoryNotFound } from '../domain/errors';
import { presentListing } from '../domain/presenter';
import { DirectoryAudit } from './directory-audit.service';
import { DirectoryMediaService, type UploadedImage } from './media.service';

/** Admin management of doctor listings. */
@Injectable()
export class AdminDoctorService {
  constructor(
    @Inject(DOCTOR_LISTING_REPOSITORY) private readonly listings: DoctorListingRepository,
    @Inject(CATALOG_DIRECTORY_REPOSITORY) private readonly catalog: CatalogDirectoryRepository,
    private readonly media: DirectoryMediaService,
    private readonly audit: DirectoryAudit,
  ) {}

  async list() {
    return (await this.listings.listAdmin()).map(presentListing);
  }

  async create(body: Row, adminId: string) {
    const { followupFees, ...data } = adminDoctor(body);
    // The phone is how this doctor later finds their record and signs up.
    const mobile = bdMobileSchema.safeParse(body.phone);
    if (!mobile.success) throw new DirectoryValidationError('Enter the doctor\'s mobile number, e.g. 01712345678');
    const row = await this.listings.createWithUser(
      {
        ...data,
        name: withDoctorPrefix(data.name),
        phone: toNationalPhone(mobile.data),
        followupFees: followupFees ?? 300,
        weeklySchedule: weeklySchedule(body.weeklySchedule),
      },
      mobile.data,
    );
    await this.catalog.ensureSpecialty(row.specialty);
    await this.audit.record(adminId, 'doctor_created', 'doctor_listing', row.id, { name: row.name });
    return presentListing(row);
  }

  /** A full replace, except that an unsent schedule is kept. */
  async update(id: string, body: Row, adminId: string) {
    const row = await this.listings.update(id, {
      ...adminDoctor(body),
      ...(body.weeklySchedule === undefined ? {} : { weeklySchedule: weeklySchedule(body.weeklySchedule) }),
    });
    if (!row) throw directoryNotFound('Doctor');
    await this.catalog.ensureSpecialty(row.specialty);
    await this.audit.record(adminId, 'doctor_updated', 'doctor_listing', id, { name: row.name });
    return presentListing(row);
  }

  async setHidden(id: string, hidden: boolean, adminId: string) {
    const row = await this.listings.setHidden(id, hidden);
    if (!row) throw directoryNotFound('Doctor');
    await this.audit.record(adminId, hidden ? 'doctor_hidden' : 'doctor_shown', 'doctor_listing', id);
    return row;
  }

  async remove(id: string, adminId: string) {
    const bookings = await this.listings.bookingCount(id);
    if (bookings) {
      throw dependantsExist(`This doctor has ${bookings} booking(s), so they can't be deleted. Hide them instead.`);
    }
    const row = await this.listings.delete(id);
    if (!row) throw directoryNotFound('Doctor');
    await this.media.discard(row.photo);
    await this.audit.record(adminId, 'doctor_deleted', 'doctor_listing', id, { name: row.name });
    return { id };
  }

  async setPhoto(id: string, file: UploadedImage | undefined) {
    const photo = await this.media.store(file, 'doctor-photos', `doctor-upload-${id}`);
    const previous = await this.listings.setPhoto(id, photo);
    if (previous === undefined) {
      await this.media.discard(photo);
      throw directoryNotFound('Doctor');
    }
    await this.media.discard(previous);
    return { photo };
  }

  async removePhoto(id: string) {
    const previous = await this.listings.setPhoto(id, null);
    if (previous === undefined) throw directoryNotFound('Doctor');
    await this.media.discard(previous);
    return { photo: null };
  }
}
