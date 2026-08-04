import { Inject, Injectable } from '@nestjs/common';
import {
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
  type AppointmentRepository,
  type AppointmentWithPatient,
  type AuditRepository,
  type PatientRepository,
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

    if (!canTransition(existing.status, next)) {
      throw new ConflictError(
        'INVALID_TRANSITION',
        `An appointment that is ${existing.status.toLowerCase()} cannot become ${next.toLowerCase()}.`,
      );
    }

    const now = this.clock.now();
    await this.appointments.updateStatus(appointmentId, next, now);

    if (next === AppointmentStatus.DONE) {
      await this.patients.touchLastVisit(existing.patientId, now);
    }

    await this.audit.record({
      actorUserId: principal.userId,
      action: `appointment.status.${next.toLowerCase()}`,
      resourceType: 'appointment',
      resourceId: appointmentId,
      practiceId: existing.practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    this.events.publish({
      type: 'appointment.status_changed',
      appointmentId,
      practiceId: existing.practiceId,
      status: next,
    });
    this.events.publish({
      type: 'queue.changed',
      practiceId: existing.practiceId,
      date: existing.scheduledAt.toISOString().slice(0, 10),
    });

    const updated = await this.appointments.findById(appointmentId);
    if (!updated) throw new NotFoundError('Appointment');
    return updated;
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

  async queueSummary(
    practiceId: string,
    day: Date,
    principal: AuthenticatedPrincipal,
  ): Promise<QueueSummary> {
    this.assertPracticeAccess(principal, practiceId);

    const from = this.clock.startOfDay(day, 'Asia/Dhaka');
    const to = this.clock.endOfDay(day, 'Asia/Dhaka');
    const counts = await this.appointments.countsByStatus(practiceId, from, to);

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
