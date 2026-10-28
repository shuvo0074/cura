import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fromDateKey, layout, toDateKey, type CalendarLane } from '@cura/shared';
import { minuteOfDay } from './calendar-shared';
import { DayColumn, type GridGeometry } from './DayColumn';
import { useAppointmentDrag } from './use-appointment-drag';
import type { Closure, GridConfig } from './use-calendar-settings';
import styles from './grid.module.css';

/** Smallest legible slot row; a 5–10 minute slot would otherwise be a sliver. */
const MIN_ROW_HEIGHT = 26;

/** Wall-clock minute, re-rendered on each minute boundary for the "now" line. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000));
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000));
    return () => clearTimeout(timer);
  }, []);
  return now;
}

/**
 * Day / 3 Day / Week time grid (spec: Middle Part).
 *
 * X axis is days, Y axis is slots of the practice's appointment duration
 * across its session hours. The header row and the time gutter stay pinned
 * while the body scrolls in either direction.
 */
export function TimeGrid({
  lanes,
  config,
  closures,
  selectedId,
  onSelect,
  onSlotClick,
  onMove,
}: {
  lanes: readonly CalendarLane[];
  config: GridConfig;
  closures: readonly Closure[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Present only for users who may book (APPOINTMENT_WRITE). */
  onSlotClick?: ((at: Date) => void) | undefined;
  /** Present only for users who may reschedule; asks for confirmation. */
  onMove?: ((id: string, at: Date) => void) | undefined;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const now = useNow();
  const todayKey = toDateKey(now);

  // Hours stretch to cover any booking made outside the session window, so
  // nothing on the diary is ever unreachable.
  const geometry = useMemo<GridGeometry>(() => {
    const slot = config.slotMinutes;
    let first = config.startMinute;
    let last = config.endMinute;
    for (const lane of lanes) {
      for (const a of lane.appointments) {
        const begin = minuteOfDay(new Date(a.scheduledAt));
        first = Math.min(first, begin);
        last = Math.max(last, begin + a.durationMinutes);
      }
    }
    const start = Math.floor(first / slot) * slot;
    const rows = Math.max(1, Math.ceil((Math.min(last, 24 * 60) - start) / slot));
    return { start, rows, slot, rowHeight: Math.max(slot * layout.calendarPixelsPerMinute, MIN_ROW_HEIGHT) };
  }, [config, lanes]);

  const daysKey = lanes.map((l) => l.date).join();
  const showsToday = lanes.some((l) => l.date === todayKey);

  // On load or navigation: bring the current time into view on today's
  // columns, otherwise the start of the first session.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const nowMinute = minuteOfDay(new Date());
    const inRange = nowMinute >= geometry.start && nowMinute < geometry.start + geometry.rows * geometry.slot;
    const target =
      showsToday && inRange
        ? ((nowMinute - geometry.start) / geometry.slot) * geometry.rowHeight - el.clientHeight / 3
        : ((config.startMinute - geometry.start) / geometry.slot) * geometry.rowHeight;
    el.scrollTop = Math.max(0, target);
    // Only on a new range or a new grid shape, not on every minute tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey, geometry.start, geometry.rowHeight, config.startMinute]);

  // Drop key is `date#row`: the day column under the pointer, and the slot
  // row within it unless that slot is blocked.
  const resolveDrop = useCallback(
    (x: number, y: number) => {
      const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-date]');
      if (!column || !scroller.current?.contains(column)) return null;
      const row = Math.floor((y - column.getBoundingClientRect().top) / geometry.rowHeight);
      if (row < 0 || row >= geometry.rows || column.children[row]?.hasAttribute('data-blocked')) return null;
      return `${column.dataset.date}#${row}`;
    },
    [geometry],
  );
  const dropAt = useCallback(
    (id: string, target: string) => {
      const [date, row] = target.split('#');
      const day = fromDateKey(date!);
      const minute = geometry.start + Number(row) * geometry.slot;
      onMove?.(id, new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute));
    },
    [geometry, onMove],
  );
  const { drag, start: pressMove } = useAppointmentDrag(resolveDrop, onMove ? dropAt : undefined);
  const [dropDate, dropRow] = drag?.target?.split('#') ?? [];

  const labels = useMemo(
    () =>
      Array.from({ length: geometry.rows }, (_, row) => {
        const minute = geometry.start + row * geometry.slot;
        return new Date(2000, 0, 1, 0, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }),
    [geometry],
  );

  return (
    <div className={styles.scroller} ref={scroller}>
      <div
        className={styles.table}
        style={{ gridTemplateColumns: `var(--grid-gutter) repeat(${lanes.length}, minmax(var(--grid-min-col), 1fr))` }}
        data-days={lanes.length}
      >
        <div className={styles.corner} />
        {lanes.map((lane) => {
          const day = fromDateKey(lane.date);
          const closed = config.hasSessions && (config.sessionsByDay[day.getDay()]?.length ?? 0) === 0;
          return (
            <div key={lane.date} className={styles.dayHead} data-today={lane.date === todayKey || undefined}>
              <span className={styles.dayName}>{day.toLocaleDateString([], { weekday: 'short' })}</span>
              <span className={styles.dayNumber}>{day.getDate()}</span>
              {closed && <span className={styles.dayClosed}>Closed</span>}
            </div>
          );
        })}

        <div className={styles.gutter}>
          {labels.map((label, row) => (
            <span key={row} className={styles.gutterLabel} style={{ height: geometry.rowHeight }}>
              {label}
            </span>
          ))}
        </div>

        {lanes.map((lane) => (
          <DayColumn
            key={lane.date}
            date={lane.date}
            appointments={lane.appointments}
            geometry={geometry}
            config={config}
            closures={closures}
            selectedId={selectedId}
            nowMinute={lane.date === todayKey ? minuteOfDay(now) : null}
            narrow={lanes.length > 3}
            movingId={drag?.id ?? null}
            dropRow={dropDate === lane.date ? Number(dropRow) : null}
            onSelect={onSelect}
            onSlotClick={onSlotClick}
            onPressMove={onMove ? pressMove : undefined}
          />
        ))}
      </div>
    </div>
  );
}
