import { useCallback, useEffect, useMemo, useState } from 'react';
import { businessRules } from '@cura/shared';
import { useServices } from '../../app/services';
import { hhmmToMinutes } from './calendar-shared';

/**
 * Practice configuration the grid is drawn from.
 *
 * Slot length and visible hours come from Settings (appointment duration and
 * weekly session timings). Settings is admin-only, so for desk and doctor
 * accounts nothing is requested at all and the grid falls back to the
 * business-rule defaults — the diary must still work for them. A failure is
 * treated the same way: absent data, never an error on the calendar.
 */

export interface Session {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface PracticeInfo {
  name: string;
  specialization: string | null;
  slotMinutes: number;
  showTodayFirst: boolean;
  sessions: Session[];
}

export interface StaffMember {
  userId: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  role: string;
  bmdcNumber: string | null;
  isActive: boolean;
}

export interface Closure {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface GridConfig {
  slotMinutes: number;
  /** Earliest session start / latest session end across the week, in minutes. */
  startMinute: number;
  endMinute: number;
  /** Session windows per weekday (0 = Sunday); empty means the day is closed. */
  sessionsByDay: ReadonlyArray<ReadonlyArray<{ start: number; end: number }>>;
  /** True when sessions are known; without them nothing is shaded as closed. */
  hasSessions: boolean;
}

/** Loads `path` when `enabled`; `data` stays null when disabled or refused. */
function useOptional<T>(path: string, query: Record<string, string>, enabled: boolean) {
  const { http } = useServices();
  const [data, setData] = useState<T | null>(null);
  const key = JSON.stringify(query);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return;
      const result = await http.request<T>(path, {
        query: JSON.parse(key) as Record<string, string>,
        ...(signal ? { signal } : {}),
      });
      if (!signal?.aborted && result.ok) setData(result.value);
    },
    [http, path, key, enabled],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { data, reload: load };
}

export function useCalendarSettings(
  practiceId: string,
  access: { settings: boolean; staff: boolean },
) {
  const practice = useOptional<PracticeInfo>('/settings/practice', { practiceId }, access.settings);
  const staff = useOptional<StaffMember[]>('/settings/staff', { practiceId }, access.staff);

  const config = useMemo<GridConfig>(() => {
    const sessions = practice.data?.sessions ?? [];
    const fallback = businessRules.calendar.workingHours;
    const byDay = Array.from({ length: 7 }, (_, day) =>
      sessions
        .filter((s) => s.dayOfWeek === day)
        .map((s) => ({ start: hhmmToMinutes(s.startTime), end: hhmmToMinutes(s.endTime) })),
    );
    const all = byDay.flat();

    return {
      slotMinutes: practice.data?.slotMinutes ?? businessRules.calendar.defaultSlotMinutes,
      startMinute: all.length ? Math.min(...all.map((s) => s.start)) : hhmmToMinutes(fallback.start),
      endMinute: all.length ? Math.max(...all.map((s) => s.end)) : hhmmToMinutes(fallback.end),
      sessionsByDay: byDay,
      hasSessions: all.length > 0,
    };
  }, [practice.data]);

  return {
    config,
    practiceName: practice.data?.name ?? null,
    specialization: practice.data?.specialization ?? null,
    showTodayFirst: practice.data?.showTodayFirst ?? null,
    // Without access `data` stays null: the directory is hidden, not an error.
    staff: staff.data?.filter((member) => member.isActive) ?? null,
  };
}

/** Practice closures (Block Calendar) overlapping the visible range. */
export function useClosures(practiceId: string, from: Date, to: Date, enabled: boolean) {
  const { data, reload } = useOptional<Closure[]>(
    '/settings/practice/closures',
    { practiceId, from: from.toISOString(), to: to.toISOString() },
    enabled,
  );
  return { closures: enabled ? (data ?? []) : [], reload };
}
