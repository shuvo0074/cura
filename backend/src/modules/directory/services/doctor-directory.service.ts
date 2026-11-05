import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/app.config';
import {
  DOCTOR_LISTING_REPOSITORY,
  DOCTOR_PROFILE_REPOSITORY,
  SERIAL_BOOKING_REPOSITORY,
  type DirectoryIdentity,
  type DoctorListingRepository,
  type DoctorProfileRepository,
  type Row,
  type SerialBookingRepository,
} from '../../../core/ports/directory.ports';
import { CLOCK, type Clock } from '../../../core/ports/services';
import { DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { presentListing } from '../domain/presenter';
import {
  bookingBlocker,
  dateOnly,
  dhakaNow,
  estimatedArrival,
  isRealDate,
  parseSessionTime,
  scheduleEntries,
} from '../domain/schedule';

const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 100_000;
const toList = (value: unknown): string[] =>
  value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : [];

/** Public read side of the doctor directory. */
@Injectable()
export class DoctorDirectoryService {
  constructor(
    @Inject(DOCTOR_LISTING_REPOSITORY) private readonly listings: DoctorListingRepository,
    @Inject(DOCTOR_PROFILE_REPOSITORY) private readonly profiles: DoctorProfileRepository,
    @Inject(SERIAL_BOOKING_REPOSITORY) private readonly bookings: SerialBookingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: AppConfigService,
  ) {}

  /** Every doctor, or one filtered page when `page` is sent. */
  async list(query: Row) {
    if (query.page === undefined) return (await this.listings.listPublic()).map(presentListing);
    const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(query.page, 10) || 1));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit, 10) || 20));
    const filters: Row = {};
    for (const column of ['specialty', 'division', 'city', 'gender']) {
      const values = toList(query[column]);
      if (values.length) filters[column] = values;
    }
    const { items, total } = await this.listings.searchPublic({
      q: String(query.q ?? '').trim(),
      filters,
      page,
      limit,
    });
    return { items: items.map(presentListing), total, page, limit };
  }

  async featured(limit: unknown) {
    const take = Math.min(Math.max(Number.parseInt(String(limit), 10) || 6, 1), 24);
    return (await this.listings.featured(take)).map(presentListing);
  }

  stats() {
    return this.listings.stats();
  }

  async byId(id: string) {
    return this.withReviews(await this.listings.findPublicById(id));
  }

  async bySlug(slug: string) {
    return this.withReviews(await this.listings.findPublicBySlug(slug.toLowerCase()));
  }

  /** A date's chamber sessions with booking state and the viewer's own serial. */
  async sessions(doctorId: string, date: unknown, identity: DirectoryIdentity | null) {
    if (!isRealDate(date)) throw new DirectoryValidationError('date query param (YYYY-MM-DD) is required');
    const doctor = await this.listings.findVisible(doctorId);
    if (!doctor) throw directoryNotFound('Doctor');

    const day = dateOnly(date);
    const [counts, mine] = await Promise.all([
      this.bookings.sessionCounts(doctorId, day),
      identity?.patientId ? this.bookings.patientActive(doctorId, day, identity.patientId) : Promise.resolve([]),
    ]);
    const now = dhakaNow(this.clock.now());
    const enabled = this.config.directory.bookingEnabled;

    const sessions = scheduleEntries(doctor.weeklySchedule).map((entry) => {
      const time = parseSessionTime(entry.time);
      const count = counts.find((c) => c.venue === entry.venue && c.sessionTime === entry.time);
      const nextSerial = (count?.lastSerial ?? 0) + 1;
      const own = mine.find((m) => m.venue === entry.venue && m.sessionTime === entry.time);
      const blocker = time
        ? bookingBlocker(date, time, now)
        : { code: 'INVALID_SESSION', message: 'This session has no valid time.' };
      const refusal = !enabled ? { code: 'BOOKING_DISABLED', message: 'Call the chamber to book.' } : blocker;
      return {
        ...entry,
        booked: count?.booked ?? 0,
        nextSerial,
        estimatedArrival: time ? estimatedArrival(time.start, nextSerial) : null,
        bookable: !refusal,
        reason: refusal?.message ?? null,
        reasonCode: refusal?.code ?? null,
        mine:
          own && time
            ? { id: own.id, serialNo: own.serialNo, estimatedArrival: estimatedArrival(time.start, own.serialNo) }
            : null,
      };
    });
    return { date, sessions };
  }

  private async withReviews(row: Row | null) {
    if (!row) throw directoryNotFound('Doctor');
    const summary = await this.profiles.reviewSummary(row.id);
    return { ...presentListing(row), review_count: summary.count, review_average: summary.average };
  }
}
