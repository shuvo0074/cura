import { memo, useState, type DragEvent } from 'react';
import { AppointmentStatus, fromDateKey, toDateKey, type CalendarLane } from '@cura/shared';
import { AppointmentCard, DRAG_TYPE } from './AppointmentCard';
import styles from './grid.module.css';

/** Chips shown per day before collapsing the rest into "+N more". */
const MAX_CHIPS = 3;

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2023, 0, 1 + i).toLocaleDateString([], { weekday: 'short' }),
);

/**
 * Month view: a wall-calendar grid of whole weeks.
 *
 * Clicking a day drills into it (Day view); clicking a chip selects that
 * appointment for the details pane without leaving the month. Dragging a chip
 * onto another day moves it there at the same time of day — the time grid is
 * where the hour changes.
 */
export const MonthGrid = memo(function MonthGrid({
  anchorDate,
  lanes,
  selectedId,
  onSelect,
  onOpenDay,
  onMove,
}: {
  anchorDate: string;
  lanes: readonly CalendarLane[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDay: (date: Date) => void;
  /** Present only for users who may reschedule; asks for confirmation. */
  onMove?: ((id: string, at: Date) => void) | undefined;
}) {
  const month = fromDateKey(anchorDate).getMonth();
  const todayKey = toDateKey(new Date());
  const [dropDate, setDropDate] = useState<string | null>(null);

  const dragOver = (date: string) => (e: DragEvent<HTMLDivElement>) => {
    if (!onMove || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropDate !== date) setDropDate(date);
  };

  const drop = (day: Date) => (e: DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData(DRAG_TYPE);
    e.preventDefault();
    setDropDate(null);
    const moving = lanes.flatMap((l) => l.appointments).find((a) => a.id === id);
    if (!moving || !onMove) return;
    // Same wall-clock time, new date.
    const from = new Date(moving.scheduledAt);
    onMove(id, new Date(day.getFullYear(), day.getMonth(), day.getDate(), from.getHours(), from.getMinutes()));
  };

  return (
    <div className={styles.scroller}>
      <div className={styles.month} style={{ gridTemplateRows: `auto repeat(${lanes.length / 7}, minmax(110px, 1fr))` }}>
        {WEEKDAYS.map((name) => (
          <div key={name} className={styles.monthHead}>
            {name}
          </div>
        ))}

        {lanes.map((lane) => {
          const day = fromDateKey(lane.date);
          const extra = lane.appointments.length - MAX_CHIPS;
          return (
            <div
              key={lane.date}
              role="button"
              tabIndex={0}
              className={styles.monthCell}
              data-outside={day.getMonth() !== month || undefined}
              data-today={lane.date === todayKey || undefined}
              data-drop={dropDate === lane.date || undefined}
              onClick={() => onOpenDay(day)}
              onDragOver={dragOver(lane.date)}
              onDragLeave={() => setDropDate((d) => (d === lane.date ? null : d))}
              onDrop={drop(day)}
              onKeyDown={(e) => e.key === 'Enter' && onOpenDay(day)}
              aria-label={`${day.toLocaleDateString([], { dateStyle: 'full' })}, ${lane.appointments.length} appointments`}
            >
              <span className={styles.monthDate}>{day.getDate()}</span>
              {lane.appointments.slice(0, MAX_CHIPS).map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  selected={a.id === selectedId}
                  onSelect={onSelect}
                  compact
                  // A finished visit is history: it cannot be moved.
                  draggable={!!onMove && a.status !== AppointmentStatus.DONE}
                  onDragEnd={() => setDropDate(null)}
                />
              ))}
              {extra > 0 && <span className={styles.more}>+{extra} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
});
