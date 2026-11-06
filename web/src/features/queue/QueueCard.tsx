import { memo } from 'react';
import { AppointmentStatus, canTransition, visitTypePrefix, type Appointment } from '@cura/shared';
import { uiStyles as s } from '../../ui';
import { useT, type TranslationKey } from '../../i18n';
import styles from './queue.module.css';

/** The one forward step each column offers as its primary action. */
const NEXT: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: TranslationKey }>> = {
  [AppointmentStatus.SCHEDULED]: { to: AppointmentStatus.WAITING, label: 'patients.queue.checkIn' },
  [AppointmentStatus.WAITING]: { to: AppointmentStatus.ENGAGED, label: 'patients.queue.callIn' },
  [AppointmentStatus.ENGAGED]: { to: AppointmentStatus.DONE, label: 'patients.queue.checkOut' },
};

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
  const { t, fmt } = useT();
  const next = NEXT[a.status];

  return (
    <article className={styles.card} aria-busy={busy || undefined}>
      <header className={styles.cardHead}>
        <span className={styles.time}>{fmt.time(a.scheduledAt)}</span>
        {a.tokenNumber !== null && <span className={styles.token}>#{fmt.number(a.tokenNumber)}</span>}
        <span className={styles.visit} title={t(`common.visitType.${a.visitType}`)}>
          {visitTypePrefix[a.visitType]}
        </span>
      </header>

      <button type="button" className={styles.name} onClick={() => onOpen(a.patient.id, a.id)}>
        {a.patient.fullName}
      </button>
      <span className={s.muted}>{a.patient.curaId}</span>

      {a.status === AppointmentStatus.WAITING && a.checkedInAt && (
        <span className={styles.waited}>{t('patients.queue.waited', { count: waited(a.checkedInAt) })}</span>
      )}
      {a.plannedProcedures.length > 0 && <span className={s.muted}>{a.plannedProcedures.join(', ')}</span>}

      {canMove && next && (
        <div className={styles.actions}>
          <button type="button" className={s.primary} disabled={busy} onClick={() => onMove(a.id, next.to)}>
            {t(next.label)}
          </button>
          {canTransition(a.status, AppointmentStatus.NO_SHOW) && (
            <button
              type="button"
              className={s.linkDanger}
              disabled={busy}
              onClick={() => onMove(a.id, AppointmentStatus.NO_SHOW)}
            >
              {t('patients.queue.noShow')}
            </button>
          )}
        </div>
      )}
    </article>
  );
});
