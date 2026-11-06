import { useEffect, useState } from 'react';
import { AppointmentStatus, type Appointment } from '@cura/shared';
import { useServices } from '../../app/services';
import { useT } from '../../i18n';
import styles from './patient.module.css';

/** Statuses a visit can still be recorded against. */
const OPEN: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.WAITING,
  AppointmentStatus.ENGAGED,
]);

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
  const { t, fmt } = useT();
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
    return <p className={styles.muted}>{t('patients.visit.onlyClinicians')}</p>;
  }
  if (today === null) return <p className={styles.muted}>{t('patients.visit.checking')}</p>;
  if (today.length === 0) {
    return (
      <p className={styles.muted}>
        {t('patients.visit.none')}
      </p>
    );
  }

  return (
    <div className={styles.startVisit}>
      <p className={styles.muted}>{t('patients.visit.prompt')}</p>
      {today.map((a) => (
        <button key={a.id} type="button" className={styles.primary} onClick={() => onStart(a.id)}>
          {t('patients.visit.start', { time: fmt.time(a.scheduledAt) })}
        </button>
      ))}
    </div>
  );
}
