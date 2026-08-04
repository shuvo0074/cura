import { Inject, Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  OtpPurpose,
  type ClinicalNoteInput,
  type PrescriptionInput,
  type VitalsInput,
} from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain-error';
import {
  APPOINTMENT_REPOSITORY,
  AUDIT_REPOSITORY,
  CONSENT_REPOSITORY,
  PATIENT_REPOSITORY,
  type AppointmentRepository,
  type AuditRepository,
  type ConsentRepository,
  type PatientRepository,
} from '../../core/ports/repositories';
import {
  CLINICAL_REPOSITORY,
  type ClinicalRepository,
  type EncounterDetail,
} from '../../core/ports/clinical.ports';
import { CLOCK, EVENT_BUS, type Clock, type EventBus } from '../../core/ports/services';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { OtpService } from '../auth/otp.service';

/**
 * Clinical record: encounters, vitals, notes, prescriptions and the timeline.
 *
 * Two invariants dominate this service:
 *
 *  1. **Privacy window.** Records older than 90 days are withheld unless the
 *     patient has granted this specific doctor an active consent. The cut-off
 *     is applied in the repository query, not filtered afterwards, so withheld
 *     rows never enter the process.
 *
 *  2. **Immutability after signing.** Once a prescription is signed the
 *     encounter is frozen. Corrections become new entries rather than edits, so
 *     the record is defensible.
 */
@Injectable()
export class ClinicalService {
  constructor(
    private readonly config: AppConfigService,
    private readonly otp: OtpService,
    @Inject(CLINICAL_REPOSITORY) private readonly clinical: ClinicalRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(CONSENT_REPOSITORY) private readonly consents: ConsentRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /**
   * Patient timeline.
   *
   * Returns `hasLockedHistory` so the client can render an explicit locked
   * state and offer the consent request, rather than showing a short list that
   * looks like the patient simply has no history.
   */
  async timeline(
    practiceId: string,
    patientId: string,
    principal: AuthenticatedPrincipal,
    query: { cursor?: string | undefined; limit: number },
  ) {
    this.assertPractice(principal, practiceId);
    const patient = await this.patients.findById(practiceId, patientId);
    if (!patient) throw new NotFoundError('Patient');

    const now = this.clock.now();
    const windowDays = this.config.rules.patient.privacyWindowDays;
    const cutoff = this.clock.addDays(now, -windowDays);

    const grant = await this.consents.activeGrant(patientId, principal.userId, now);
    const unlocked = grant !== null;

    const page = await this.clinical.timeline({
      patientId,
      notBefore: unlocked ? null : cutoff,
      query,
    });

    const hasLockedHistory = unlocked
      ? false
      : await this.clinical.hasRecordsBefore(patientId, cutoff);

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'clinical.timeline.read',
      resourceType: 'patient',
      resourceId: patientId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
      metadata: { unlocked, returned: page.items.length },
    });

    return {
      entries: page.items,
      nextCursor: page.nextCursor,
      privacyWindowDays: windowDays,
      hasLockedHistory,
      consentGrantedUntil: grant?.expiresAt.toISOString() ?? null,
    };
  }

  /**
   * Starts a consent request. An OTP goes to the patient's mobile; the doctor
   * cannot self-approve, which is what makes the unlock meaningful.
   */
  async requestConsent(practiceId: string, patientId: string, principal: AuthenticatedPrincipal) {
    this.assertPractice(principal, practiceId);
    const patient = await this.patients.findById(practiceId, patientId);
    if (!patient) throw new NotFoundError('Patient');

    const challenge = await this.otp.issue({
      purpose: OtpPurpose.PATIENT_CONSENT,
      destination: patient.mobile,
      subjectId: patientId,
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'clinical.consent.requested',
      resourceType: 'patient',
      resourceId: patientId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    return challenge;
  }

  /** Completes the consent handshake and unlocks history for a bounded period. */
  async confirmConsent(
    practiceId: string,
    challengeId: string,
    code: string,
    principal: AuthenticatedPrincipal,
  ) {
    this.assertPractice(principal, practiceId);
    const result = await this.otp.verify(challengeId, code);
    if (result.purpose !== OtpPurpose.PATIENT_CONSENT || !result.subjectId) {
      throw new ForbiddenError('That verification code is not valid for consent.');
    }

    // Deliberately time-boxed: consent unlocks a visit, not the account forever.
    const expiresAt = this.clock.addDays(this.clock.now(), 1);
    await this.consents.grant({
      patientId: result.subjectId,
      grantedToUserId: principal.userId,
      expiresAt,
      method: 'OTP',
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'clinical.consent.granted',
      resourceType: 'patient',
      resourceId: result.subjectId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return { patientId: result.subjectId, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Opens (or returns) the encounter for an appointment.
   *
   * Spec: a patient becomes "Engaged" the moment the doctor opens the
   * prescription form, so that transition happens here rather than requiring a
   * separate call the UI might forget.
   */
  async openEncounter(
    practiceId: string,
    appointmentId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<EncounterDetail> {
    this.assertPractice(principal, practiceId);

    const appointment = await this.appointments.findById(appointmentId);
    if (!appointment || appointment.practiceId !== practiceId) {
      throw new NotFoundError('Appointment');
    }

    const encounter = await this.clinical.openEncounter({
      patientId: appointment.patientId,
      doctorId: principal.userId,
      appointmentId,
      occurredAt: this.clock.now(),
    });

    if (appointment.status === AppointmentStatus.WAITING) {
      await this.appointments.updateStatus(
        appointmentId,
        AppointmentStatus.ENGAGED,
        this.clock.now(),
      );
      this.events.publish({
        type: 'queue.changed',
        practiceId,
        date: appointment.scheduledAt.toISOString().slice(0, 10),
      });
    }

    return encounter;
  }

  async saveVitals(
    practiceId: string,
    encounterId: string,
    input: VitalsInput,
    principal: AuthenticatedPrincipal,
  ): Promise<EncounterDetail> {
    await this.assertMutable(practiceId, encounterId, principal);
    await this.clinical.upsertVitals(encounterId, {
      weightKg: input.weightKg ?? null,
      systolic: input.systolic ?? null,
      diastolic: input.diastolic ?? null,
      pulseBpm: input.pulseBpm ?? null,
      temperatureC: input.temperatureC ?? null,
      respiratoryRate: input.respiratoryRate ?? null,
    });
    return this.requireEncounter(encounterId);
  }

  async saveClinicalNote(
    practiceId: string,
    encounterId: string,
    input: ClinicalNoteInput,
    principal: AuthenticatedPrincipal,
  ): Promise<EncounterDetail> {
    await this.assertMutable(practiceId, encounterId, principal);
    await this.clinical.upsertClinicalNote(encounterId, {
      complaints: input.complaints,
      observations: input.observations,
      diagnoses: input.diagnoses,
      advice: input.advice,
      notes: input.notes ?? null,
    });
    return this.requireEncounter(encounterId);
  }

  async savePrescription(
    practiceId: string,
    encounterId: string,
    input: PrescriptionInput,
    principal: AuthenticatedPrincipal,
  ): Promise<EncounterDetail> {
    await this.assertMutable(practiceId, encounterId, principal);

    await this.clinical.upsertPrescription(encounterId, {
      items: input.items.map((item) => ({
        drugName: item.drugName,
        strength: item.strength ?? null,
        form: item.form ?? null,
        durationDays: item.durationDays ?? null,
        morning: item.morning,
        noon: item.noon,
        night: item.night,
        mealRelation: item.mealRelation,
        instruction: item.instruction ?? null,
      })),
      investigations: input.investigations,
      followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'clinical.prescription.saved',
      resourceType: 'encounter',
      resourceId: encounterId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
      metadata: { itemCount: input.items.length },
    });

    return this.requireEncounter(encounterId);
  }

  /**
   * Signs and closes the visit.
   *
   * Marks the appointment DONE — the spec counts a patient as complete only
   * once the prescription is finalised, which is exactly this moment.
   */
  async signEncounter(
    practiceId: string,
    encounterId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<EncounterDetail> {
    const encounter = await this.assertMutable(practiceId, encounterId, principal);

    const now = this.clock.now();
    await this.clinical.sign(encounterId, now);

    if (encounter.appointmentId) {
      const appointment = await this.appointments.findById(encounter.appointmentId);
      if (appointment && appointment.status === AppointmentStatus.ENGAGED) {
        await this.appointments.updateStatus(appointment.id, AppointmentStatus.DONE, now);
        await this.patients.touchLastVisit(appointment.patientId, now);
        this.events.publish({
          type: 'queue.changed',
          practiceId,
          date: appointment.scheduledAt.toISOString().slice(0, 10),
        });
      }
    }

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'clinical.encounter.signed',
      resourceType: 'encounter',
      resourceId: encounterId,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    return this.requireEncounter(encounterId);
  }

  // -------------------------------------------------------------------------

  private async requireEncounter(id: string): Promise<EncounterDetail> {
    const encounter = await this.clinical.findEncounter(id);
    if (!encounter) throw new NotFoundError('Encounter');
    return encounter;
  }

  /**
   * Guards every write: correct practice, encounter exists, and not yet signed.
   * Centralised so no mutation path can skip the immutability check.
   */
  private async assertMutable(
    practiceId: string,
    encounterId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<EncounterDetail> {
    this.assertPractice(principal, practiceId);

    const encounter = await this.requireEncounter(encounterId);
    const patient = await this.patients.findById(practiceId, encounter.patientId);
    if (!patient) throw new NotFoundError('Encounter');

    if (encounter.signedAt) {
      throw new ConflictError(
        'ENCOUNTER_SIGNED',
        'This visit has been signed and can no longer be edited. Create a new entry instead.',
      );
    }
    return encounter;
  }

  private assertPractice(principal: AuthenticatedPrincipal, practiceId: string): void {
    if (!principal.practiceIds.includes(practiceId)) {
      throw new ForbiddenError('You do not have access to this practice.');
    }
  }
}
