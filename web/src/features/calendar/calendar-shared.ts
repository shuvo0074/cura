/** Labels, formatting and geometry shared by the calendar's panes. */

import { useEffect, useRef } from 'react';
import { fromDateKey, type Appointment, type CalendarView } from '@cura/shared';
import { formatDate, formatDateRange, formatTime, type Locale, type TranslationKey } from '../../i18n';

/** Words for each view; show with `t(VIEW_LABELS[view])`. */
export const VIEW_LABELS: Record<CalendarView, TranslationKey> = {
  day: 'calendar.view.day',
  threeDay: 'calendar.view.threeDay',
  week: 'calendar.view.week',
  month: 'calendar.view.month',
};

export const clockTime = (date: Date, locale: Locale) => formatTime(date, locale);

/** "Tue 3 Nov, 2:30 pm" — used by the move confirmation. */
export const slotLabel = (date: Date, locale: Locale) =>
  `${formatDate(date, locale, { weekday: 'short', day: 'numeric', month: 'short' })}, ${clockTime(date, locale)}`;

/** Toolbar label for the visible range: a day, a span, or a month. */
export function rangeLabel(view: CalendarView, anchor: string, days: readonly string[], locale: Locale): string {
  if (view === 'month') {
    return formatDate(fromDateKey(anchor), locale, { month: 'long', year: 'numeric' });
  }
  const first = fromDateKey(days[0]!);
  if (days.length === 1) {
    return formatDate(first, locale, 'medium');
  }
  const last = fromDateKey(days[days.length - 1]!);
  // formatRange collapses the shared parts: "25 – 31 Oct 2026".
  return formatDateRange(first, last, locale);
}

/** Minutes since local midnight. */
export const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

export const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

/**
 * Side-by-side placement for overlapping appointments.
 *
 * Appointments are grouped into clusters that overlap transitively; each gets
 * the first free column in its cluster, and every member of a cluster shares
 * the cluster's column count so widths line up.
 */
export function layoutOverlaps(list: readonly Appointment[]): Map<string, { col: number; cols: number }> {
  const out = new Map<string, { col: number; cols: number }>();
  let cluster: Array<{ id: string; col: number }> = [];
  let columnsEnd: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const item of cluster) out.set(item.id, { col: item.col, cols: columnsEnd.length });
    cluster = [];
    columnsEnd = [];
  };

  for (const a of list) {
    const start = new Date(a.scheduledAt).getTime();
    const end = new Date(a.endsAt).getTime();
    if (start >= clusterEnd) flush();
    let col = columnsEnd.findIndex((e) => e <= start);
    if (col === -1) col = columnsEnd.push(end) - 1;
    else columnsEnd[col] = end;
    cluster.push({ id: a.id, col });
    clusterEnd = Math.max(start >= clusterEnd ? end : clusterEnd, end);
  }
  flush();
  return out;
}

/** Closes a popover on outside click or Escape. */
export function useDismiss<T extends HTMLElement = HTMLDivElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return ref;
}
