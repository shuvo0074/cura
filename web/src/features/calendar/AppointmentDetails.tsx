import { useState } from 'react';
import {
  AppointmentStatus,
  canTransition,
  initials,
  visitTypePrefix,
  type Appointment,
  type Patient,
} from '@cura/shared';
import { useResource } from '../../ui';
import { clockTime } from './calendar-shared';
import styles from './panes.module.css';

const VISIT_LABELS: Record<string, string> = { NEW: 'New visit', FOLLOW_UP: 'Follow-up', OLD: 'Old patient' };

/** The four attendance actions, in queue order. Enablement follows `canTransition`. */
const ACTIONS = [
  { label: 'Check in', to: AppointmentStatus.WAITING },
  { label: 'Engage', to: AppointmentStatus.ENGAGED },
  { label: 'Check out', to: AppointmentStatus.DONE },
  { label: 'No show', to: AppointmentStatus.NO_SHOW },
] as const;

/** `datetime-local` wants wall-clock text, not UTC. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/**
 * Patient details box (spec: Right Part).
 *
 * The appointment carries only a patient summary, so email and the profile
 * completion flag are read from the patient record.
 */
export function AppointmentDetails({
  practiceId,
  appointment,
  doctorName,
  canReschedule,
  canChangeStatus,
  onChangeStatus,
  onReschedule,
  onOpenPatient,
  onBack,
}: {
  practiceId: string;
  appointment: Appointment;
  /** Whose diary the visit is in; omitted while the doctor list loads. */
  doctorName?: string | undefined;
  canReschedule: boolean;
  canChangeStatus: boolean;
  onChangeStatus: (status: AppointmentStatus) => void;
  onReschedule: (at: Date) => Promise<boolean>;
  onOpenPatient?: ((patientId: string, appointmentId?: string) => void) | undefined;
  onBack: () => void;
}) {
  const { data: patient } = useResource<Patient>(`/patients/${appointment.patient.id}`, { practiceId });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = new Date(appointment.scheduledAt);
  const status = appointment.status;

  const saveTime = async () => {
    if (!editing) return;
    setSaving(true);
    const ok = await onReschedule(new Date(editing));
    setSaving(false);
    if (ok) setEditing(null);
  };

  return (
    <div className={styles.details}>
      <button type="button" className={styles.back} onClick={onBack}>
        ‹ Today&rsquo;s list
      </button>

      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(appointment.patient.fullName)}
        </span>
        <div>
          <h2 className={styles.detailsName}>
            <span className={styles.prefix} data-visit={appointment.visitType.toLowerCase()}>
              {visitTypePrefix[appointment.visitType]}
            </span>
            {appointment.patient.fullName}
          </h2>
          <p className={styles.detailsMeta}>
            {appointment.patient.curaId}
            {appointment.tokenNumber !== null && ` · Token #${appointment.tokenNumber}`}
          </p>
          {patient && (
            <span className={styles.profileFlag} data-complete={patient.profileComplete || undefined}>
              {patient.profileComplete ? '✓ Profile complete' : '⚠ Profile incomplete'}
            </span>
          )}
        </div>
      </div>

      <span className={styles.statusPill} data-status={status.toLowerCase()}>
        {status.replace('_', ' ').toLowerCase()}
      </span>

      {canChangeStatus && (
        <div className={styles.actions}>
          {ACTIONS.map((action) => (
            <button
              key={action.to}
              type="button"
              onClick={() => onChangeStatus(action.to)}
              disabled={!canTransition(status, action.to)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <dl className={styles.facts}>
        <dt>Phone</dt>
        <dd>{appointment.patient.mobile || 'Not available'}</dd>
        <dt>Email</dt>
        <dd>{patient?.email ?? 'Not available'}</dd>
        <dt>Appointed</dt>
        <dd>
          {editing !== null ? (
            <span className={styles.editTime}>
              <input
                type="datetime-local"
                value={editing}
                onChange={(e) => setEditing(e.target.value)}
                aria-label="New appointment time"
              />
              <button type="button" onClick={() => void saveTime()} disabled={saving || !editing}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </span>
          ) : (
            <>
              {start.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })},{' '}
              {clockTime(start)} for {appointment.durationMinutes} mins
              {canReschedule && status !== AppointmentStatus.DONE && (
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={() => setEditing(toLocalInput(appointment.scheduledAt))}
                >
                  Edit
                </button>
              )}
            </>
          )}
        </dd>
        {doctorName && (
          <>
            <dt>Doctor</dt>
            <dd>{doctorName}</dd>
          </>
        )}
        <dt>Visit</dt>
        <dd>{VISIT_LABELS[appointment.visitType] ?? appointment.visitType}</dd>
        <dt>Planned procedures</dt>
        <dd>{appointment.plannedProcedures.length ? appointment.plannedProcedures.join(', ') : 'Not specified'}</dd>
        {appointment.notes && (
          <>
            <dt>Notes</dt>
            <dd>{appointment.notes}</dd>
          </>
        )}
      </dl>

      {onOpenPatient && (
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => onOpenPatient(appointment.patient.id, appointment.id)}
        >
          Open patient record / Write prescription
        </button>
      )}
    </div>
  );
}
