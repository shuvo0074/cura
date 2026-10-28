import type { ReactNode } from 'react';
import { isCancelled, visitTypePrefix, type Appointment, type QueueSummary } from '@cura/shared';
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
  const visible = showCancelled ? today : today.filter((a) => !isCancelled(a.status));

  return (
    <aside className={styles.right} aria-label="Today's schedule">
      <h2 className={styles.paneTitle}>Today&rsquo;s Schedule</h2>

      {onAddWalkIn && (
        <button type="button" className={styles.walkIn} onClick={onAddWalkIn}>
          + Add Walk-in Appointment
        </button>
      )}

      {queue && (
        <div className={styles.counters}>
          <Counter label="Waiting" value={queue.waiting} tone="waiting" />
          <Counter label="Engaged" value={queue.engaged} tone="engaged" />
          <Counter label="Done" value={queue.done} tone="done" />
          <Counter label="Cancelled" value={queue.cancelled} tone="cancelled" />
        </div>
      )}

      {details ?? (
        <>
          <p className={styles.placeholder}>Select a patient slot to view details.</p>
          {visible.length === 0 ? (
            <p className={styles.placeholder}>No appointments today.</p>
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
                    <span className={styles.todayTime}>{clockTime(new Date(a.scheduledAt))}</span>
                    <span className={styles.todayName}>
                      <span className={styles.prefix} data-visit={a.visitType.toLowerCase()}>
                        {visitTypePrefix[a.visitType]}
                      </span>
                      {a.patient.fullName}
                      <DoctorDot doctorId={a.doctorId} className={styles.todayDoctor} />
                    </span>
                    <span className={styles.todayReason}>
                      {a.plannedProcedures[0] ?? 'Visit reason not specified'}
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
