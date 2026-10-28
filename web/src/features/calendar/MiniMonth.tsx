import { memo, useMemo } from 'react';
import { CalendarViewModel, fromDateKey, toDateKey } from '@cura/shared';
import styles from './panes.module.css';

/**
 * Mini navigator (spec: Left Part, "Block Calendar").
 *
 * Its arrows browse months on their own; only picking a date moves the main
 * grid. A dot marks days with bookings, a strong dot heavy ones.
 */
export const MiniMonth = memo(function MiniMonth({
  month,
  anchorDate,
  load,
  onBrowse,
  onPick,
}: {
  /** `YYYY-MM` being browsed. */
  month: string;
  anchorDate: string;
  load: Readonly<Record<string, number>>;
  onBrowse: (direction: -1 | 1) => void;
  onPick: (date: Date) => void;
}) {
  const first = fromDateKey(`${month}-01`);
  const todayKey = toDateKey(new Date());

  const days = useMemo(() => {
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const count = last.getDate() + first.getDay() + (6 - last.getDay());
    return Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    // `first` is derived from `month`; that is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  return (
    <div className={styles.mini}>
      <div className={styles.miniHead}>
        <button type="button" onClick={() => onBrowse(-1)} aria-label="Previous month">
          ‹
        </button>
        <span>{first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
        <button type="button" onClick={() => onBrowse(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className={styles.miniGrid} role="grid" aria-label="Pick a date">
        {days.slice(0, 7).map((d) => (
          <span key={`h${d.getDay()}`} className={styles.miniWeekday}>
            {d.toLocaleDateString([], { weekday: 'narrow' })}
          </span>
        ))}
        {days.map((d) => {
          const key = toDateKey(d);
          const count = load[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              className={styles.miniDay}
              data-outside={d.getMonth() !== first.getMonth() || undefined}
              data-today={key === todayKey || undefined}
              data-selected={key === anchorDate || undefined}
              data-load={
                count >= CalendarViewModel.HEAVY_DAY_THRESHOLD ? 'heavy' : count > 0 ? 'some' : undefined
              }
              onClick={() => onPick(d)}
              aria-label={`${d.toLocaleDateString([], { dateStyle: 'long' })}${count ? `, ${count} bookings` : ''}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
});
