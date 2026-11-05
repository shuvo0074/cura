import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/app.config';
import {
  DOCTOR_LISTING_REPOSITORY,
  SERIAL_BOOKING_REPOSITORY,
  type DirectoryIdentity,
  type DoctorListingRepository,
  type Row,
  type SerialBookingRepository,
} from '../../../core/ports/directory.ports';
import { CLOCK, type Clock } from '../../../core/ports/services';
import { toNationalPhone } from '../domain/account-rules';
import { DirectoryError, DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { present, presentBooking } from '../domain/presenter';
import {
  bookingBlocker,
  dateOnly,
  dhakaNow,
  estimatedArrival,
  isRealDate,
  minutesToTime,
  parseSessionTime,
  scheduleEntries,
} from '../domain/schedule';
import { DirectoryAudit } from './directory-audit.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withArrival(row: Row): Row {
  const { patientMobile, ...rest } = row;
  const out = presentBooking(rest as Row & { bookingDate: Date; startTime: string });
  if ('patientMobile' in row) out.patient_phone = toNationalPhone(patientMobile);
  const time = parseSessionTime(row.sessionTime);
  return time ? { ...out, estimated_arrival: estimatedArrival(time.start, row.serialNo) } : out;
}

/** Serial bookings and the reviews that depend on them. */
@Injectable()
export class SerialBookingService {
  constructor(
    @Inject(SERIAL_BOOKING_REPOSITORY) private readonly bookings: SerialBookingRepository,
    @Inject(DOCTOR_LISTING_REPOSITORY) private readonly listings: DoctorListingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: AppConfigService,
    private readonly audit: DirectoryAudit,
  ) {}

  async book(identity: DirectoryIdentity, body: Row) {
    if (!this.config.directory.bookingEnabled) {
      throw new DirectoryError(HttpStatus.FORBIDDEN, 'BOOKING_DISABLED', 'Online booking is not available. Call the chamber to book.');
    }
    const { doctorId, date, venue, session, notes } = body ?? {};
    if (!doctorId || !date || !venue || !session) {
      throw new DirectoryValidationError('doctorId, date, venue and session are required');
    }
    if (!isRealDate(date)) throw new DirectoryValidationError('date must be YYYY-MM-DD');
    if (typeof doctorId !== 'string' || !UUID.test(doctorId)) throw directoryNotFound('Doctor');

    const doctor = await this.listings.findVisible(doctorId);
    if (!doctor) throw directoryNotFound('Doctor');
    const entry = scheduleEntries(doctor.weeklySchedule).find((e) => e.venue === venue && e.time === session);
    const time = entry ? parseSessionTime(entry.time) : null;
    if (!time) throw new DirectoryError(HttpStatus.BAD_REQUEST, 'NO_SUCH_SESSION', 'This doctor has no such chamber session.');
    const blocker = bookingBlocker(date, time, dhakaNow(this.clock.now()));
    if (blocker) throw new DirectoryError(HttpStatus.BAD_REQUEST, blocker.code, blocker.message);

    const row = await this.bookings.book({
      patientId: identity.patientId!,
      doctorId,
      bookingDate: dateOnly(date),
      startTime: minutesToTime(time.start),
      venue,
      sessionTime: session,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 1000) : null,
    });
    await this.audit.record(identity.userId, 'booking_created', 'serial_booking', row.id, { doctorId, serialNo: row.serialNo });
    return withArrival(row);
  }

  async forPatient(patientId: string) {
    return (await this.bookings.listForPatient(patientId)).map(withArrival);
  }

  async forDoctor(doctorId: string) {
    return (await this.bookings.listForDoctor(doctorId)).map(withArrival);
  }

  async all(status: unknown) {
    const filter = typeof status === 'string' && ['confirmed', 'completed', 'cancelled'].includes(status) ? status : null;
    return (await this.bookings.listAll(filter)).map(withArrival);
  }

  /** Only a confirmed booking can be cancelled, never one already completed. */
  async cancel(id: string, identity: DirectoryIdentity) {
    const row = await this.bookings.cancel(id, identity.patientId!);
    if (!row) throw directoryNotFound('Appointment');
    await this.audit.record(identity.userId, 'booking_cancelled', 'serial_booking', id);
    return withArrival(row);
  }

  async complete(id: string, identity: DirectoryIdentity) {
    const row = await this.bookings.complete(id, identity.doctorId!);
    if (!row) throw directoryNotFound('Appointment');
    await this.audit.record(identity.userId, 'booking_completed', 'serial_booking', id);
    return withArrival(row);
  }

  async review(id: string, identity: DirectoryIdentity, body: Row) {
    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new DirectoryValidationError('Choose a rating from 1 to 5 stars');
    }
    const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 1000) || null : null;
    const patientId = identity.patientId!;
    const booking = await this.bookings.findForReview(id, patientId);
    if (!booking) throw directoryNotFound('Appointment');
    if (booking.status !== 'COMPLETED') {
      throw new DirectoryError(HttpStatus.BAD_REQUEST, 'NOT_COMPLETED', 'You can review a visit once the doctor marks it completed');
    }
    const review = await this.bookings.addReview({ bookingId: id, doctorId: booking.doctorId, patientId, rating, comment });
    if (!review) throw new DirectoryError(HttpStatus.CONFLICT, 'ALREADY_REVIEWED', 'You have already reviewed this visit');
    return present(review);
  }
}
