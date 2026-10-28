import { memo } from 'react';
import { AppointmentStatus, canTransition, visitTypePrefix, type Appointment } from '@cura/shared';
import { uiStyles as s } from '../../ui';
import styles from './queue.module.css';

/** The one forward step each column offers as its primary action. */
const NEXT: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  [AppointmentStatus.SCHEDULED]: { to: AppointmentStatus.WAITING, label: 'Check in' },
  [AppointmentStatus.WAITING]: { to: AppointmentStatus.ENGAGED, label: 'Call in' },
  [AppointmentStatus.ENGAGED]: { to: AppointmentStatus.DONE, label: 'Check out' },
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Minutes since check-in, so the desk can see who has waited longest. */
const waited = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

export const QueueCard = memo(function QueueCard({
  appointment: a,
  busy,
  canMove,
  onMove,
  onOpen,
}: {
  appointment: Appointment;
  busy: boolean;
  canMove: boolean;
  onMove: (id: string, status: AppointmentStatus) => void;
  onOpen: (patientId: string, appointmentId?: string) => void;
}) {
  const next = NEXT[a.status];

  return (
    <article className={styles.card} aria-busy={busy || undefined}>
      <header className={styles.cardHead}>
        <span className={styles.time}>{clock(a.scheduledAt)}</span>
        {a.tokenNumber !== null && <span className={styles.token}>#{a.tokenNumber}</span>}
        <span className={styles.visit} title={a.visitType}>
          {visitTypePrefix[a.visitType]}
        </span>
      </header>

      <button type="button" className={styles.name} onClick={() => onOpen(a.patient.id, a.id)}>
        {a.patient.fullName}
      </button>
      <span className={s.muted}>{a.patient.curaId}</span>

      {a.status === AppointmentStatus.WAITING && a.checkedInAt && (
        <span className={styles.waited}>Waiting {waited(a.checkedInAt)} min</span>
      )}
      {a.plannedProcedures.length > 0 && <span className={s.muted}>{a.plannedProcedures.join(', ')}</span>}

      {canMove && next && (
        <div className={styles.actions}>
          <button type="button" className={s.primary} disabled={busy} onClick={() => onMove(a.id, next.to)}>
            {next.label}
          </button>
          {canTransition(a.status, AppointmentStatus.NO_SHOW) && (
            <button
              type="button"
              className={s.linkDanger}
              disabled={busy}
              onClick={() => onMove(a.id, AppointmentStatus.NO_SHOW)}
            >
              No show
            </button>
          )}
        </div>
      )}
    </article>
  );
});
