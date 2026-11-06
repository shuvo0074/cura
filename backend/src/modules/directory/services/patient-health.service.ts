import { Inject, Injectable } from '@nestjs/common';
import {
  PATIENT_HEALTH_REPOSITORY,
  type DirectoryIdentity,
  type PatientHealthRepository,
} from '../../../core/ports/directory.ports';
import { CLOCK, type Clock } from '../../../core/ports/services';

/** Enough for years of visits; the page is one read, not a paged feed. */
const LIMIT = 200;

const dateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

/**
 * "My health" on Cura Website: a patient reads their own visits, prescriptions,
 * vital signs, invoices and upcoming clinic appointments, across every clinic
 * they joined.
 *
 * Whose records load is decided only by the signed-in account: no patient or
 * clinic id comes from the client. Leaving a clinic clears the link, so its
 * records drop out.
 *
 * The clinics' 90-day privacy window does not apply here. That rule stops clinic
 * staff from reading old history without the patient's consent, and the consent
 * is the patient's own code. The patient reading their own record is the person
 * the rule protects, so there is nobody to ask.
 */
@Injectable()
export class PatientHealthService {
  constructor(
    @Inject(PATIENT_HEALTH_REPOSITORY) private readonly health: PatientHealthRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async mine(identity: DirectoryIdentity) {
    const accountId = identity.patientId!;
    const [visits, invoices, appointments] = await Promise.all([
      this.health.signedVisits(accountId, LIMIT),
      this.health.invoices(accountId, LIMIT),
      this.health.upcomingAppointments(accountId, this.clock.now(), LIMIT),
    ]);

    return {
      visits: visits.map((visit) => ({
        id: visit.id,
        occurred_at: visit.occurredAt.toISOString(),
        clinic_name: visit.clinicName,
        doctor_name: visit.doctorName,
        complaints: visit.complaints,
        diagnoses: visit.diagnoses,
        advice: visit.advice,
        vitals: visit.vitals && {
          weight_kg: visit.vitals.weightKg,
          systolic: visit.vitals.systolic,
          diastolic: visit.vitals.diastolic,
          pulse_bpm: visit.vitals.pulseBpm,
          temperature_c: visit.vitals.temperatureC,
        },
        prescription: visit.prescription && {
          investigations: visit.prescription.investigations,
          follow_up_date: dateOnly(visit.prescription.followUpDate),
          items: visit.prescription.items.map((item) => ({
            drug_name: item.drugName,
            form: item.form,
            strength: item.strength,
            morning: item.morning,
            noon: item.noon,
            night: item.night,
            meal_relation: item.mealRelation.toLowerCase(),
            duration_days: item.durationDays,
            instruction: item.instruction,
          })),
        },
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        date: invoice.date.toISOString(),
        clinic_name: invoice.clinicName,
        status: invoice.status.toLowerCase(),
        total_minor: invoice.totalMinor,
        paid_minor: invoice.paidMinor,
        items: invoice.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          total_minor: item.totalMinor,
        })),
      })),
      upcoming_appointments: appointments.map((appointment) => ({
        id: appointment.id,
        scheduled_at: appointment.scheduledAt.toISOString(),
        clinic_name: appointment.clinicName,
        doctor_name: appointment.doctorName,
        status: appointment.status.toLowerCase(),
      })),
    };
  }
}
