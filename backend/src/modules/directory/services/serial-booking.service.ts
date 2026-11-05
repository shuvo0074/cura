import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app.config';
import {
  DOCTOR_LISTING_REPOSITORY,
  SERIAL_BOOKING_REPOSITORY,
  type DirectoryIdentity,
  type DoctorListingRepository,
  type Row,
  type SerialBookingRepository,
} from '../../../core/ports/directory.ports';
import {
  PATIENT_REPOSITORY,
  WEBSITE_BOOKING_LINK,
  type PatientRepository,
  type WebsiteBookingLinkRepository,
} from '../../../core/ports/repositories';
import { CLOCK, type Clock } from '../../../core/ports/services';
import { AppointmentService } from '../../appointments/appointment.service';
import { toNationalPhone } from '../domain/account-rules';
import { DirectoryError, DirectoryValidationError, directoryNotFound } from '../domain/errors';
import { present, presentBooking } from '../domain/presenter';
import {
  bookingBlocker,
  clinicForVenue,
  dateOnly,
  dhakaNow,
  estimatedArrival,
  isRealDate,
  minutesToTime,
  parseSessionTime,
  scheduleEntries,
  type ScheduleEntry,
  type SessionTime,
} from '../domain/schedule';
import { DirectoryAudit } from './directory-audit.service';

/** Starts the notes of a clinic appointment booked on Cura Website; Cura Dashboard looks for it. */
export const WEBSITE_NOTE = 'Booked on Cura Website';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What happened on the clinic's side of a booking: `sent` when it is in the
 * clinic's calendar, `website_only` when the venue is not a clinic on Cura (or
 * it could not be placed), `phone_required` when the account has no mobile.
 */
type ClinicStatus = 'sent' | 'website_only' | 'phone_required';

function withArrival(row: Row): Row {
  const { patientMobile, appointmentId: _appointmentId, ...rest } = row;
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
    @Inject(WEBSITE_BOOKING_LINK) private readonly clinicLink: WebsiteBookingLinkRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    private readonly appointments: AppointmentService,
    private readonly config: AppConfigService,
    private readonly audit: DirectoryAudit,
  ) {}

  private readonly logger = new Logger(SerialBookingService.name);

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
    const clinic = await this.sendToClinic(identity, doctor.userId, entry!, time, row, date);
    return { ...withArrival(row), clinic_status: clinic.status, clinic_name: clinic.name };
  }

  /**
   * Puts the booking in the clinic's calendar when the venue is a clinic on
   * Cura where this doctor works. The website booking stands either way.
   */
  private async sendToClinic(
    identity: DirectoryIdentity,
    doctorUserId: string,
    entry: ScheduleEntry,
    time: SessionTime,
    row: Row,
    date: string,
  ): Promise<{ status: ClinicStatus; name: string | null }> {
    try {
      const clinic = clinicForVenue(await this.clinicLink.doctorClinics(doctorUserId), entry);
      if (!clinic) return { status: 'website_only', name: null };

      const accountId = identity.patientId!;
      let patientId = await this.clinicLink.clinicPatientId(accountId, clinic.practiceId);
      if (!patientId) {
        // Clinics reach patients by phone, so their record requires one.
        if (!identity.mobile) return { status: 'phone_required', name: clinic.name };
        patientId = (
          await this.patients.create({
            practiceId: clinic.practiceId,
            fullName: identity.name,
            mobile: identity.mobile,
            email: identity.email,
            accountId,
          })
        ).id;
      }

      const reason = typeof row.notes === 'string' && row.notes ? ` Reason: ${row.notes}` : '';
      const appointment = await this.appointments.bookFromWebsite({
        practiceId: clinic.practiceId,
        doctorId: doctorUserId,
        patientId,
        date,
        sessionStart: time.start,
        sessionEnd: time.end,
        serialNo: row.serialNo,
        slotMinutes: clinic.slotMinutes,
        timeZone: clinic.timezone,
        notes: `${WEBSITE_NOTE}: serial #${row.serialNo}, ${row.sessionTime}.${reason}`,
        actorUserId: identity.userId,
      });
      await this.clinicLink.link(row.id, appointment.id);
      return { status: 'sent', name: clinic.name };
    } catch (error) {
      this.logger.error(`Booking ${row.id} could not reach the clinic: ${(error as Error).message}`);
      return { status: 'website_only', name: null };
    }
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
    if (row.appointmentId) await this.appointments.cancelFromWebsite(row.appointmentId, identity.userId);
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
