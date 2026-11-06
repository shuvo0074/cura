/** Types and helpers shared by the practice-operations panels. */

import { formatTime, translate, type Locale } from '../../../i18n';

/**
 * Calendar defaults, communications, data security and premium.
 *
 * These four are small forms over the same practice row (plus the notification
 * matrix), so they share a file rather than each carrying its own module.
 */

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;
const dayShort = (locale: Locale, day: number) =>
  translate(locale, `settings.dayShort.${DAY_INDEXES[day] ?? 0}`);

export interface PracticeSettings {
  name: string;
  slotMinutes: number;
  showTodayFirst: boolean;
  smsLanguage: string;
  hideCancelledInvoices: boolean;
  hideCancelledPayments: boolean;
  contactNumber: string | null;
  email: string | null;
  sessions: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
}

// -- Calendar ---------------------------------------------------------------

/** "Mon to Sun: 9:00am – 7:00pm", collapsing runs of identical days. */
export function summarise(sessions: PracticeSettings['sessions'], locale: Locale = 'en'): string {
  if (sessions.length === 0) return translate(locale, 'settings.calendar.notConfigured');

  const byDay = new Map<number, string>();
  for (const session of sessions) {
    const text = `${hhmm(session.startTime, locale)}–${hhmm(session.endTime, locale)}`;
    byDay.set(session.dayOfWeek, byDay.has(session.dayOfWeek) ? `${byDay.get(session.dayOfWeek)}, ${text}` : text);
  }

  const groups: Array<{ days: number[]; text: string }> = [];
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const text = byDay.get(day)!;
    const last = groups[groups.length - 1];
    if (last && last.text === text && last.days[last.days.length - 1] === day - 1) last.days.push(day);
    else groups.push({ days: [day], text });
  }

  return groups
    .map((g) => {
      const span =
        g.days.length === 1
          ? dayShort(locale, g.days[0]!)
          : translate(locale, 'settings.calendar.dayRange', {
              from: dayShort(locale, g.days[0]!),
              to: dayShort(locale, g.days[g.days.length - 1]!),
            });
      return `${span}: ${g.text}`;
    })
    .join('   ');
}

/** "09:30" as written today in English; in Bangla, a clock time with Bangla digits. */
function hhmm(value: string, locale: Locale): string {
  if (locale === 'en') return value;
  const [h, m] = value.split(':').map(Number);
  return formatTime(new Date(2000, 0, 1, h ?? 0, m ?? 0), locale);
}

// -- Communications ---------------------------------------------------------

export interface CommRow {
  category: string;
  type: string;
  label: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
  offsetDays: number | null;
}

/** Notification categories with a `settings.comms.cat.*` label. */
export const CATEGORIES = ['APPOINTMENT', 'FOLLOW_UP', 'PAYMENT', 'WISHES'] as const;
export const isCategory = (value: string): value is (typeof CATEGORIES)[number] =>
  (CATEGORIES as readonly string[]).includes(value);

// -- Data security ----------------------------------------------------------

export interface AccountProfile {
  fullName: string;
  email: string | null;
  mobile: string | null;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  mobileVerified: boolean;
}

// -- Premium ----------------------------------------------------------------
