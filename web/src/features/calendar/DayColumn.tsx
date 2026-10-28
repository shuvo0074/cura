import { memo, useMemo, type MouseEvent, type PointerEvent } from 'react';
import { AppointmentStatus, fromDateKey, type Appointment } from '@cura/shared';
import { AppointmentCard } from './AppointmentCard';
import { layoutOverlaps, minuteOfDay } from './calendar-shared';
import type { Closure, GridConfig } from './use-calendar-settings';
import styles from './grid.module.css';

export interface GridGeometry {
  /** First visible minute of the day and number of slot rows. */
  start: number;
  rows: number;
  slot: number;
  rowHeight: number;
}

/**
 * One day of the time grid: slot boxes underneath, appointment cards on top.
 *
 * Slot clicks are delegated to the column (one handler, not one per box): the
 * row is derived from the pointer's offset. While a card is dragged, TimeGrid
 * resolves the drop row from `data-date` and the slot boxes' `data-blocked`.
 */
export const DayColumn = memo(function DayColumn({
  date,
  appointments,
  geometry,
  config,
  closures,
  selectedId,
  nowMinute,
  narrow,
  movingId,
  dropRow,
  onSelect,
  onSlotClick,
  onPressMove,
}: {
  date: string;
  appointments: readonly Appointment[];
  geometry: GridGeometry;
  config: GridConfig;
  closures: readonly Closure[];
  selectedId: string | null;
  /** Minute of day for the "now" line; null when this column is not today. */
  nowMinute: number | null;
  narrow: boolean;
  /** Card being dragged, if it is on this day. */
  movingId: string | null;
  dropRow: number | null;
  onSelect: (id: string) => void;
  onSlotClick?: ((at: Date) => void) | undefined;
  /** Present only for users who may reschedule. */
  onPressMove?: ((id: string, e: PointerEvent<HTMLElement>) => void) | undefined;
}) {
  const { start, rows, slot, rowHeight } = geometry;
  const day = useMemo(() => fromDateKey(date), [date]);

  /** Per-row availability: outside a session is closed, inside a closure is blocked. */
  const slots = useMemo(() => {
    const sessions = config.sessionsByDay[day.getDay()] ?? [];
    return Array.from({ length: rows }, (_, row) => {
      const from = start + row * slot;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, from).getTime();
      const blocked = closures.find(
        (c) => new Date(c.startsAt).getTime() < at + slot * 60_000 && new Date(c.endsAt).getTime() > at,
      );
      const closed = config.hasSessions && !sessions.some((s) => from >= s.start && from < s.end);
      return { from, blocked, closed };
    });
  }, [config, closures, day, rows, start, slot]);

  const placement = useMemo(() => layoutOverlaps(appointments), [appointments]);

  const slotAt = (row: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, start + row * slot);

  const rowFromPointer = (e: { clientY: number; currentTarget: HTMLElement }) => {
    const top = e.currentTarget.getBoundingClientRect().top;
    const row = Math.floor((e.clientY - top) / rowHeight);
    return row >= 0 && row < rows ? row : null;
  };

  const click = (e: MouseEvent<HTMLDivElement>) => {
    if (!onSlotClick) return;
    const row = rowFromPointer(e);
    if (row !== null && !slots[row]!.blocked) onSlotClick(slotAt(row));
  };

  return (
    <div
      className={styles.column}
      style={{ height: rows * rowHeight }}
      data-bookable={onSlotClick ? true : undefined}
      data-date={date}
      onClick={click}
    >
      {slots.map((s, row) => (
        <div
          key={s.from}
          className={styles.slot}
          style={{ height: rowHeight }}
          data-hour={s.from % 60 === 0 || undefined}
          data-closed={s.closed || undefined}
          data-blocked={s.blocked ? true : undefined}
          data-drop={dropRow === row || undefined}
          title={s.blocked ? (s.blocked.reason ?? 'Blocked') : undefined}
        />
      ))}

      {appointments.map((a) => {
        const at = placement.get(a.id) ?? { col: 0, cols: 1 };
        const top = ((minuteOfDay(new Date(a.scheduledAt)) - start) / slot) * rowHeight;
        const height = Math.max((a.durationMinutes / slot) * rowHeight, rowHeight) - 2;
        return (
          <AppointmentCard
            key={a.id}
            appointment={a}
            selected={a.id === selectedId}
            onSelect={onSelect}
            hideTime={narrow}
            style={{
              top: top + 1,
              height,
              left: `calc(${(at.col / at.cols) * 100}% + 2px)`,
              width: `calc(${100 / at.cols}% - 4px)`,
            }}
            // A finished visit is history: it cannot be moved.
            movable={!!onPressMove && a.status !== AppointmentStatus.DONE}
            moving={a.id === movingId}
            onPressMove={onPressMove}
          />
        );
      })}

      {nowMinute !== null && nowMinute >= start && nowMinute <= start + rows * slot && (
        <div
          className={styles.nowLine}
          style={{ top: ((nowMinute - start) / slot) * rowHeight }}
          aria-hidden="true"
        />
      )}
    </div>
  );
});
