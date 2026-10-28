/** Types and helpers shared by the practice-operations panels. */

/**
 * Calendar defaults, communications, data security and premium.
 *
 * These four are small forms over the same practice row (plus the notification
 * matrix), so they share a file rather than each carrying its own module.
 */

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
export function summarise(sessions: PracticeSettings['sessions']): string {
  if (sessions.length === 0) return 'Not configured';

  const byDay = new Map<number, string>();
  for (const session of sessions) {
    const text = `${session.startTime}–${session.endTime}`;
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
      const span = g.days.length === 1 ? DAYS[g.days[0]!] : `${DAYS[g.days[0]!]} to ${DAYS[g.days[g.days.length - 1]!]}`;
      return `${span}: ${g.text}`;
    })
    .join('   ');
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

export const CATEGORY_LABEL: Record<string, string> = {
  APPOINTMENT: 'Appointments',
  FOLLOW_UP: 'Preventive follow-up',
  PAYMENT: 'Payment',
  WISHES: 'Wishes',
};

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
