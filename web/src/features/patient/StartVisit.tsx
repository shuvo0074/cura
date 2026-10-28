import { useEffect, useState } from 'react';
import { AppointmentStatus, type Appointment } from '@cura/shared';
import { useServices } from '../../app/services';
import styles from './patient.module.css';

/** Statuses a visit can still be recorded against. */
const OPEN: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.WAITING,
  AppointmentStatus.ENGAGED,
]);

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Shown in the Charting tab when the record was opened without an appointment
 * (search, the Patients list). A visit is always tied to an appointment, so
 * this offers the patient's open appointments today instead of a dead end.
 */
export function StartVisit({
  practiceId,
  patientId,
  canWrite,
  onStart,
}: {
  practiceId: string;
  patientId: string;
  canWrite: boolean;
  onStart: (appointmentId: string) => void;
}) {
  const { appointments } = useServices();
  const [today, setToday] = useState<Appointment[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    void appointments
      .listRange({
        practiceId,
        from: from.toISOString(),
        to: new Date(from.getTime() + 86_400_000).toISOString(),
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setToday(result.ok ? result.value.filter((a) => a.patientId === patientId && OPEN.has(a.status)) : []);
      });
    return () => controller.abort();
  }, [appointments, practiceId, patientId]);

  if (!canWrite) {
    return <p className={styles.muted}>Only a doctor or administrator can record a visit.</p>;
  }
  if (today === null) return <p className={styles.muted}>Checking today’s appointments…</p>;
  if (today.length === 0) {
    return (
      <p className={styles.muted}>
        No open appointment today for this patient. Book one with + Add Patient, then start the visit here.
      </p>
    );
  }

  return (
    <div className={styles.startVisit}>
      <p className={styles.muted}>Start the visit to write vitals, notes and the prescription.</p>
      {today.map((a) => (
        <button key={a.id} type="button" className={styles.primary} onClick={() => onStart(a.id)}>
          Start visit — {clock(a.scheduledAt)} appointment
        </button>
      ))}
    </div>
  );
}
