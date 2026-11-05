/**
 * Chamber sessions and serial booking rules. All times are Asia/Dhaka, whatever
 * the server's own timezone is.
 */
export const OFF_DAY = 5; // Friday, 0 = Sunday
export const MINUTES_PER_SERIAL = 10;
export const BOOKING_WINDOW_DAYS = 30;

export interface SessionTime {
  start: number;
  end: number;
}

export interface DhakaNow {
  date: string;
  minutes: number;
}

export interface ScheduleEntry {
  venue?: string;
  time?: string;
  [key: string]: unknown;
}

function parseClock(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1]!, 10) % 12;
  if (match[3]!.toUpperCase() === 'PM') hour += 12;
  return hour * 60 + parseInt(match[2]!, 10);
}

/** "08:00 AM - 11:00 AM" becomes minutes since midnight. */
export function parseSessionTime(range: unknown): SessionTime | null {
  const [a, b] = String(range).split('-');
  const start = a ? parseClock(a) : null;
  const end = b ? parseClock(b) : null;
  return start !== null && end !== null ? { start, end } : null;
}

export function minutesToClock(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${suffix}`;
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function dhakaNow(now: Date): DhakaNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: parseInt(parts.hour!, 10) * 60 + parseInt(parts.minute!, 10),
  };
}

/** A calendar date as the value Prisma stores in a `@db.Date` column. */
export const dateOnly = (date: string): Date => new Date(`${date}T00:00:00Z`);

export function isRealDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = dateOnly(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  const value = dateOnly(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export const estimatedArrival = (sessionStart: number, serialNo: number): string =>
  minutesToClock(sessionStart + (serialNo - 1) * MINUTES_PER_SERIAL);

export const BLOCKER_MESSAGES = {
  CLOSED_FRIDAY: 'Chambers are closed on Fridays.',
  DATE_PASSED: 'That date has already passed.',
  TOO_FAR_AHEAD: `Bookings open ${BOOKING_WINDOW_DAYS} days in advance.`,
  SESSION_ENDED: 'This session has already ended today.',
} as const;

export type BlockerCode = keyof typeof BLOCKER_MESSAGES;

/** Why a session cannot be booked on a date, or null when it can. */
export function bookingBlocker(
  date: string,
  session: SessionTime,
  now: DhakaNow,
): { code: BlockerCode; message: string } | null {
  let code: BlockerCode | null = null;
  if (dateOnly(date).getUTCDay() === OFF_DAY) code = 'CLOSED_FRIDAY';
  else if (date < now.date) code = 'DATE_PASSED';
  else if (date > addDays(now.date, BOOKING_WINDOW_DAYS)) code = 'TOO_FAR_AHEAD';
  else if (date === now.date && now.minutes >= session.end) code = 'SESSION_ENDED';
  return code ? { code, message: BLOCKER_MESSAGES[code] } : null;
}

export function scheduleEntries(value: unknown): ScheduleEntry[] {
  return Array.isArray(value) ? (value as ScheduleEntry[]) : [];
}

const venueKey = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The clinic on Cura a chamber session takes place at. A clinic named like the
 * venue wins; otherwise a doctor with a single clinic is booked there, unless
 * the session is at a listed hospital.
 */
export function clinicForVenue<T extends { name: string }>(clinics: T[], entry: ScheduleEntry): T | null {
  const exact = clinics.find((clinic) => venueKey(clinic.name) === venueKey(entry.venue));
  if (exact) return exact;
  return clinics.length === 1 && !entry.hospital_id ? clinics[0]! : null;
}
