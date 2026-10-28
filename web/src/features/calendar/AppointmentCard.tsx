import { memo, type CSSProperties, type DragEvent } from 'react';
import { visitTypePrefix, type Appointment } from '@cura/shared';
import { clockTime } from './calendar-shared';
import styles from './calendar.module.css';

/** MIME type used to carry an appointment id through a drag. */
export const DRAG_TYPE = 'application/x-cura-appointment';

/**
 * Appointment card, placed in its slot on the time grid.
 *
 * Memoised on identity: a lane re-render caused by a sibling status change does
 * not repaint unaffected cards. With 30+ slots per day across a week view this
 * is the difference between repainting ~10 nodes and ~200.
 *
 * `compact` is the month-view chip: one line, no time column.
 */
export const AppointmentCard = memo(function AppointmentCard({
  appointment,
  selected,
  onSelect,
  style,
  compact,
  hideTime,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  appointment: Appointment;
  selected: boolean;
  onSelect: (id: string) => void;
  style?: CSSProperties;
  compact?: boolean;
  /** Week columns are too narrow for the time; the gutter already shows it. */
  hideTime?: boolean;
  draggable?: boolean;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}) {
  const start = new Date(appointment.scheduledAt);

  const beginDrag = (e: DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, appointment.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(appointment.id);
  };

  return (
    <button
      type="button"
      className={compact ? styles.chip : styles.card}
      style={style}
      data-status={appointment.status.toLowerCase()}
      data-selected={selected || undefined}
      onClick={(e) => {
        // The slot underneath would otherwise read this as "book here".
        e.stopPropagation();
        onSelect(appointment.id);
      }}
      aria-pressed={selected}
      // The only cue for what can move: done visits are history and the server
      // refuses to reschedule them, so say so instead of silently not dragging.
      title={`${clockTime(start)} · ${appointment.patient.fullName}${
        draggable ? ' — drag to move' : appointment.status === 'DONE' ? ' — finished visits can’t be moved' : ''
      }`}
      draggable={draggable}
      onDragStart={draggable ? beginDrag : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      <span className={styles.visitBadge} data-visit={appointment.visitType.toLowerCase()}>
        {visitTypePrefix[appointment.visitType]}
      </span>
      <span className={styles.cardName}>{appointment.patient.fullName}</span>
      {!compact && !hideTime && <span className={styles.cardTime}>{clockTime(start)}</span>}
    </button>
  );
});
