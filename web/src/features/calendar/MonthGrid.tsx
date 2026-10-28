import { memo } from 'react';
import { fromDateKey, toDateKey, type CalendarLane } from '@cura/shared';
import { AppointmentCard } from './AppointmentCard';
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
 * appointment for the details pane without leaving the month.
 */
export const MonthGrid = memo(function MonthGrid({
  anchorDate,
  lanes,
  selectedId,
  onSelect,
  onOpenDay,
}: {
  anchorDate: string;
  lanes: readonly CalendarLane[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDay: (date: Date) => void;
}) {
  const month = fromDateKey(anchorDate).getMonth();
  const todayKey = toDateKey(new Date());

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
              onClick={() => onOpenDay(day)}
              onKeyDown={(e) => e.key === 'Enter' && onOpenDay(day)}
              aria-label={`${day.toLocaleDateString([], { dateStyle: 'full' })}, ${lane.appointments.length} appointments`}
            >
              <span className={styles.monthDate}>{day.getDate()}</span>
              {lane.appointments.slice(0, MAX_CHIPS).map((a) => (
                <AppointmentCard key={a.id} appointment={a} selected={a.id === selectedId} onSelect={onSelect} compact />
              ))}
              {extra > 0 && <span className={styles.more}>+{extra} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
});
