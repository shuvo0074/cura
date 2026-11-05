import { Inject, Injectable } from '@nestjs/common';
import {
  Permission,
  AppointmentStatus,
  canTransition,
  VisitType,
  type CreateAppointmentInput,
  type QueueSummary,
} from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/domain-error';
import {
  APPOINTMENT_REPOSITORY,
  AUDIT_REPOSITORY,
  PATIENT_REPOSITORY,
  WEBSITE_BOOKING_LINK,
  type AppointmentRecord,
  type AppointmentRepository,
  type AppointmentWithPatient,
  type AuditRepository,
  type PatientRepository,
  type WebsiteBookingLinkRepository,
} from '../../core/ports/repositories';
import {
  CLOCK,
  EVENT_BUS,
  type Clock,
  type EventBus,
} from '../../core/ports/services';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';

/**
 * Appointment scheduling and queue transitions.
 *
 * All invariants that make the calendar trustworthy live here rather than in a
 * controller: slot alignment, double-booking prevention, tenancy checks, and
 * the legal status graph. Controllers only translate HTTP into these calls.
 */
@Injectable()
export class AppointmentService {
  constructor(
    private readonly config: AppConfigService,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(WEBSITE_BOOKING_LINK) private readonly websiteBookings: WebsiteBookingLinkRepository,
  ) {}

  async create(
    input: CreateAppointmentInput,
    principal: AuthenticatedPrincipal,
  ): Promise<AppointmentWithPatient> {
    this.assertPracticeAccess(principal, input.practiceId);

    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new ValidationError('The appointment time is not a valid date.');
    }
    // Bookings belong to a doctor's diary. Without this, a desk booking sent
    // with the booker's own id would file the visit under the receptionist.
    const doctors = await this.appointments.listDoctors(input.practiceId);
    if (!doctors.some((d) => d.id === input.doctorId)) {
      throw new ValidationError('Choose a doctor of this practice for the appointment.');
    }

    const endsAt = this.clock.addSeconds(scheduledAt, input.durationMinutes * 60);

    // Resolve or create the patient before taking the slot, so a failed intake
    // never leaves an orphaned booking.
    const patientId = input.patientId
      ? await this.requireExistingPatient(input.practiceId, input.patientId)
      : await this.createPatientFromIntake(input);

    /**
     * Double-booking guard. Checked immediately before insert; the unique load
     * on (doctorId, scheduledAt) plus this read keeps concurrent bookings from
     * silently stacking on one slot.
     */
    const clashes = await this.appointments.findOverlapping({
      doctorId: input.doctorId,
      from: scheduledAt,
      to: endsAt,
    });
    if (clashes.length > 0) {
      throw new ConflictError(
        'SLOT_UNAVAILABLE',
        'That time slot is already booked. Choose another slot.',
      );
    }

    const tokenNumber = await this.appointments.nextTokenNumber(
      input.practiceId,
      input.doctorId,
      scheduledAt,
    );

    const created = await this.appointments.create({
      practiceId: input.practiceId,
      doctorId: input.doctorId,
      patientId,
      scheduledAt,
      endsAt,
      durationMinutes: input.durationMinutes,
      visitType: input.visitType ?? VisitType.NEW,
      plannedProcedures: input.plannedProcedures ?? [],
      notes: input.notes ?? null,
      tokenNumber,
      createdById: principal.userId,
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'appointment.create',
      resourceType: 'appointment',
      resourceId: created.id,
      practiceId: input.practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    // Published, not awaited: SMS dispatch must not extend the response.
    this.events.publish({
      type: 'appointment.created',
      appointmentId: created.id,
      practiceId: input.practiceId,
      doctorId: input.doctorId,
      patientId,
    });
    this.events.publish({
      type: 'queue.changed',
      practiceId: input.practiceId,
      date: scheduledAt.toISOString().slice(0, 10),
    });

    const full = await this.appointments.findById(created.id);
    if (!full) throw new NotFoundError('Appointment');
    return full;
  }

  /**
   * Moves an appointment through the queue.
   *
   * The transition table in `@cura/shared` is the single authority, so the web
   * app, the mobile app and the API all agree on what is reachable from where.
   */
  async changeStatus(
    appointmentId: string,
    next: AppointmentStatus,
    principal: AuthenticatedPrincipal,
  ): Promise<AppointmentWithPatient> {
    const existing = await this.appointments.findById(appointmentId);
    if (!existing) throw new NotFoundError('Appointment');
    this.assertPracticeAccess(principal, existing.practiceId);

    if (existing.status === next) return existing;

    // Cancelling is front-desk work: a doctor can move a visit through the queue but not cancel it.
    if (next === AppointmentStatus.CANCELLED && !principal.permissions.includes(Permission.APPOINTMENT_CANCEL)) {
      throw new ForbiddenError('Only the front desk or an administrator can cancel a visit.');
    }

    if (!canTransition(existing.status, next)) {
      throw new ConflictError(
        'INVALID_TRANSITION',
        `An appointment that is ${existing.status.toLowerCase()} cannot become ${next.toLowerCase()}.`,
      );
    }

    await this.applyStatus(existing, next, principal.userId);

    const updated = await this.appointments.findById(appointmentId);
    if (!updated) throw new NotFoundError('Appointment');
    return updated;
  }

  /**
   * A booking made on Cura Website, placed in the clinic's calendar. The
   * patient is not a clinic member, so there is no principal: the caller has
   * already matched the doctor to this clinic and found the clinic's patient
   * record. The visit goes at its serial's place in the session, else the next
   * free slot, else the session start so the clinic still sees it.
   */
  async bookFromWebsite(input: {
    practiceId: string;
    doctorId: string;
    patientId: string;
    /** YYYY-MM-DD, the clinic's local date. */
    date: string;
    /** Minutes since local midnight. */
    sessionStart: number;
    sessionEnd: number;
    serialNo: number;
    slotMinutes: number;
    timeZone: string;
    notes: string;
    actorUserId: string;
  }): Promise<AppointmentWithPatient> {
    const doctors = await this.appointments.listDoctors(input.practiceId);
    if (!doctors.some((d) => d.id === input.doctorId)) {
      throw new ValidationError('This doctor does not see patients at this clinic.');
    }

    const slot = Math.max(1, input.slotMinutes);
    const midnight = this.clock.startOfDay(new Date(`${input.date}T12:00:00Z`), input.timeZone);
    const at = (minutes: number) => this.clock.addSeconds(midnight, minutes * 60);
    const sessionFrom = at(input.sessionStart);
    const sessionTo = at(Math.max(input.sessionEnd, input.sessionStart + slot));

    const taken = await this.appointments.findOverlapping({
      doctorId: input.doctorId,
      from: sessionFrom,
      to: sessionTo,
    });
    const free = (start: Date) => {
      const end = this.clock.addSeconds(start, slot * 60);
      return !taken.some((a) => a.scheduledAt < end && a.endsAt > start);
    };
    const slots: Date[] = [];
    for (let m = input.sessionStart; m + slot <= input.sessionEnd; m += slot) slots.push(at(m));
    const preferred = Math.max(0, input.serialNo - 1);
    // The serial's own slot, then later ones, then earlier ones.
    const order = [...slots.slice(preferred), ...slots.slice(0, Math.min(preferred, slots.length))];
    const scheduledAt = order.find(free) ?? sessionFrom;
    const endsAt = this.clock.addSeconds(scheduledAt, slot * 60);

    const tokenNumber = await this.appointments.nextTokenNumber(
      input.practiceId,
      input.doctorId,
      scheduledAt,
    );
    const created = await this.appointments.create({
      practiceId: input.practiceId,
      doctorId: input.doctorId,
      patientId: input.patientId,
      scheduledAt,
      endsAt,
      durationMinutes: slot,
      visitType: VisitType.NEW,
      plannedProcedures: [],
      notes: input.notes.slice(0, 1000),
      tokenNumber,
      createdById: input.actorUserId,
    });

    await this.audit.record({
      actorUserId: input.actorUserId,
      action: 'appointment.create.website',
      resourceType: 'appointment',
      resourceId: created.id,
      practiceId: input.practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });
    this.events.publish({
      type: 'appointment.created',
      appointmentId: created.id,
      practiceId: input.practiceId,
      doctorId: input.doctorId,
      patientId: input.patientId,
    });
    this.events.publish({
      type: 'queue.changed',
      practiceId: input.practiceId,
      date: scheduledAt.toISOString().slice(0, 10),
    });

    const full = await this.appointments.findById(created.id);
    if (!full) throw new NotFoundError('Appointment');
    return full;
  }

  /**
   * The patient cancelled on Cura Website. Follows the clinic's status rules:
   * a visit already done or closed stays as it is.
   */
  async cancelFromWebsite(appointmentId: string, actorUserId: string): Promise<void> {
    const existing = await this.appointments.findById(appointmentId);
    if (!existing || !canTransition(existing.status, AppointmentStatus.CANCELLED)) return;
    await this.applyStatus(existing, AppointmentStatus.CANCELLED, actorUserId);
  }

  private async applyStatus(
    existing: AppointmentRecord,
    next: AppointmentStatus,
    actorUserId: string,
  ): Promise<void> {
    const now = this.clock.now();
    await this.appointments.updateStatus(existing.id, next, now);

    if (next === AppointmentStatus.DONE) {
      await this.patients.touchLastVisit(existing.patientId, now);
    }

    await this.audit.record({
      actorUserId,
      action: `appointment.status.${next.toLowerCase()}`,
      resourceType: 'appointment',
      resourceId: existing.id,
      practiceId: existing.practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    // A visit booked on Cura Website: the patient's booking follows. A no-show
    // ends it as cancelled, since only a completed visit can be reviewed.
    const settled =
      next === AppointmentStatus.DONE
        ? 'COMPLETED'
        : next === AppointmentStatus.CANCELLED || next === AppointmentStatus.NO_SHOW
          ? 'CANCELLED'
          : null;
    if (settled) await this.websiteBookings.settle(existing.id, settled);

    this.events.publish({
      type: 'appointment.status_changed',
      appointmentId: existing.id,
      practiceId: existing.practiceId,
      status: next,
    });
    this.events.publish({
      type: 'queue.changed',
      practiceId: existing.practiceId,
      date: existing.scheduledAt.toISOString().slice(0, 10),
    });
  }

  /** Drag-and-drop reschedule. Re-runs the same overlap invariant. */
  async reschedule(
    appointmentId: string,
    newStart: Date,
    principal: AuthenticatedPrincipal,
    durationMinutes?: number,
  ): Promise<AppointmentWithPatient> {
    const existing = await this.appointments.findById(appointmentId);
    if (!existing) throw new NotFoundError('Appointment');
    this.assertPracticeAccess(principal, existing.practiceId);

    if (existing.status === AppointmentStatus.DONE) {
      throw new ConflictError('ALREADY_COMPLETED', 'A completed visit cannot be rescheduled.');
    }

    const duration = durationMinutes ?? existing.durationMinutes;
    const endsAt = this.clock.addSeconds(newStart, duration * 60);

    const clashes = await this.appointments.findOverlapping({
      doctorId: existing.doctorId,
      from: newStart,
      to: endsAt,
      excludeId: appointmentId,
    });
    if (clashes.length > 0) {
      throw new ConflictError('SLOT_UNAVAILABLE', 'That time slot is already booked.');
    }

    await this.appointments.reschedule(appointmentId, newStart, endsAt, duration);

    this.events.publish({
      type: 'appointment.rescheduled',
      appointmentId,
      practiceId: existing.practiceId,
      previousAt: existing.scheduledAt.toISOString(),
      newAt: newStart.toISOString(),
    });

    const updated = await this.appointments.findById(appointmentId);
    if (!updated) throw new NotFoundError('Appointment');
    return updated;
  }

  async listRange(
    practiceId: string,
    from: Date,
    to: Date,
    principal: AuthenticatedPrincipal,
    options: { doctorId?: string | undefined; includeCancelled?: boolean } = {},
  ): Promise<AppointmentWithPatient[]> {
    this.assertPracticeAccess(principal, practiceId);

    // Bound the window so a client cannot ask for a decade in one request.
    const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (spanDays <= 0 || spanDays > 62) {
      throw new ValidationError('Requested date range must be between 1 and 62 days.');
    }

    return this.appointments.findInRange({
      practiceId,
      doctorId: options.doctorId,
      from,
      to,
      includeCancelled: options.includeCancelled ?? false,
    });
  }

  async dailyCounts(
    practiceId: string,
    from: Date,
    to: Date,
    timeZone: string,
    principal: AuthenticatedPrincipal,
    doctorId?: string,
  ): Promise<Array<{ date: string; count: number }>> {
    this.assertPracticeAccess(principal, practiceId);

    const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (spanDays <= 0 || spanDays > 62) {
      throw new ValidationError('Requested date range must be between 1 and 62 days.');
    }
    // The zone reaches SQL as a bound parameter, but an unknown name would
    // still fail there as a 500; reject it here as the client error it is.
    try {
      new Intl.DateTimeFormat('en', { timeZone });
    } catch {
      throw new ValidationError('Unknown time zone.');
    }

    return this.appointments.dailyCounts({ practiceId, doctorId, from, to, timeZone });
  }

  async queueSummary(
    practiceId: string,
    day: Date,
    principal: AuthenticatedPrincipal,
    doctorId?: string,
  ): Promise<QueueSummary> {
    this.assertPracticeAccess(principal, practiceId);

    const from = this.clock.startOfDay(day, 'Asia/Dhaka');
    const to = this.clock.endOfDay(day, 'Asia/Dhaka');
    const counts = await this.appointments.countsByStatus(practiceId, from, to, doctorId);

    return {
      date: day.toISOString().slice(0, 10),
      waiting: counts[AppointmentStatus.WAITING],
      engaged: counts[AppointmentStatus.ENGAGED],
      done: counts[AppointmentStatus.DONE],
      cancelled: counts[AppointmentStatus.CANCELLED] + counts[AppointmentStatus.NO_SHOW],
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  }

  // -------------------------------------------------------------------------

  /**
   * Tenancy check.
   *
   * Every entry point asserts the caller belongs to the practice before any row
   * is read or written. Without this an authenticated doctor could address
   * another clinic's data simply by changing an id in the URL.
   */
  /** Bookable doctors, for the calendar's doctor filter and the booking form. */
  async listDoctors(practiceId: string, principal: AuthenticatedPrincipal) {
    this.assertPracticeAccess(principal, practiceId);
    return this.appointments.listDoctors(practiceId);
  }

  private assertPracticeAccess(principal: AuthenticatedPrincipal, practiceId: string): void {
    if (!principal.practiceIds.includes(practiceId)) {
      throw new ForbiddenError('You do not have access to this practice.');
    }
  }

  private async requireExistingPatient(practiceId: string, patientId: string): Promise<string> {
    const patient = await this.patients.findById(practiceId, patientId);
    if (!patient) throw new NotFoundError('Patient');
    return patient.id;
  }

  private async createPatientFromIntake(input: CreateAppointmentInput): Promise<string> {
    if (!input.patient) throw new ValidationError('Patient details are required.');

    // Reuse an existing record when the mobile already exists, rather than
    // creating a duplicate (spec: "check if this number is already in the
    // database to prevent duplicate parent accounts").
    const existing = await this.patients.findByMobile(input.practiceId, input.patient.mobile);
    const match = existing.find(
      (p) => p.fullName.toLowerCase() === input.patient!.fullName.toLowerCase(),
    );
    if (match) return match.id;

    const created = await this.patients.create({
      practiceId: input.practiceId,
      fullName: input.patient.fullName,
      mobile: input.patient.mobile,
      email: input.patient.email ?? null,
      gender: input.patient.gender ?? null,
      dateOfBirth: input.patient.dateOfBirth ? new Date(input.patient.dateOfBirth) : null,
      bloodGroup: input.patient.bloodGroup ?? null,
      address: input.patient.address ?? null,
    });

    this.events.publish({
      type: 'patient.registered',
      patientId: created.id,
      practiceId: created.practiceId,
      curaId: created.curaId,
      mobile: created.mobile,
      fullName: created.fullName,
    });

    return created.id;
  }
}
