import type { ReactNode } from 'react';
import { isCancelled, visitTypePrefix, type Appointment, type QueueSummary } from '@cura/shared';
import { useT } from '../../i18n';
import { clockTime } from './calendar-shared';
import { DoctorDot } from './doctors';
import { Counter } from './QueueCounter';
import styles from './panes.module.css';

/**
 * Today's Schedule (spec: Right Part, Information Box).
 *
 * Walk-in button and live counters on top; below them either the selected
 * appointment's details (passed in as `details`) or today's list in time order.
 */
export function TodayPane({
  queue,
  today,
  showCancelled,
  details,
  onSelect,
  onAddWalkIn,
}: {
  queue: QueueSummary | null;
  today: readonly Appointment[];
  showCancelled: boolean;
  details: ReactNode;
  onSelect: (id: string) => void;
  onAddWalkIn?: (() => void) | undefined;
}) {
  const { t, locale } = useT();
  const visible = showCancelled ? today : today.filter((a) => !isCancelled(a.status));

  return (
    <aside className={styles.right} aria-label={t('calendar.todayPane')}>
      <h2 className={styles.paneTitle}>{t('calendar.todayTitle')}</h2>

      {onAddWalkIn && (
        <button type="button" className={styles.walkIn} onClick={onAddWalkIn}>
          {t('calendar.addWalkIn')}
        </button>
      )}

      {queue && (
        <div className={styles.counters}>
          <Counter label={t('calendar.counter.waiting')} value={queue.waiting} tone="waiting" />
          <Counter label={t('calendar.counter.engaged')} value={queue.engaged} tone="engaged" />
          <Counter label={t('calendar.counter.done')} value={queue.done} tone="done" />
          <Counter label={t('calendar.counter.cancelled')} value={queue.cancelled} tone="cancelled" />
        </div>
      )}

      {details ?? (
        <>
          <p className={styles.placeholder}>{t('calendar.selectSlot')}</p>
          {visible.length === 0 ? (
            <p className={styles.placeholder}>{t('calendar.noneToday')}</p>
          ) : (
            <ul className={styles.todayList}>
              {visible.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={styles.todayItem}
                    data-status={a.status.toLowerCase()}
                    onClick={() => onSelect(a.id)}
                  >
                    <span className={styles.todayTime}>{clockTime(new Date(a.scheduledAt), locale)}</span>
                    <span className={styles.todayName}>
                      <span className={styles.prefix} data-visit={a.visitType.toLowerCase()}>
                        {visitTypePrefix[a.visitType]}
                      </span>
                      {a.patient.fullName}
                      <DoctorDot doctorId={a.doctorId} className={styles.todayDoctor} />
                    </span>
                    <span className={styles.todayReason}>
                      {a.plannedProcedures[0] ?? t('calendar.reasonMissing')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
