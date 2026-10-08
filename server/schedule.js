// Helpers for doctors' chamber schedules (doctors.weekly_schedule): a list of
// sessions { venue, address, phone, time: "08:00 AM - 11:00 AM", note }
// that repeat every working day. Chambers are closed on Fridays.

export const OFF_DAY = 5; // Friday (0 = Sunday)
// Rough consultation length used to estimate when a serial should arrive.
export const MINUTES_PER_SERIAL = 10;
// How far ahead patients may book.
export const BOOKING_WINDOW_DAYS = 30;

function parseClock(str) {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + parseInt(m[2], 10);
}

// "08:00 AM - 11:00 AM" -> { start: 480, end: 660 } (minutes since midnight)
export function parseSessionTime(range) {
  const [a, b] = String(range).split('-');
  const start = a && parseClock(a);
  const end = b && parseClock(b);
  return start != null && end != null ? { start, end } : null;
}

export function minutesToClock(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function minutesToTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// Current date (YYYY-MM-DD) and minutes since midnight in Bangladesh time,
// independent of the server's own timezone.
export function dhakaNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map(p => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10),
  };
}

export function dayOfWeek(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Estimated arrival time for a serial, e.g. serial 5 in an 08:00 session -> "08:40 AM".
export function estimatedArrival(sessionStart, serialNo) {
  return minutesToClock(sessionStart + (serialNo - 1) * MINUTES_PER_SERIAL);
}

// Why a session can't be booked on `date`, or null if it can.
// Why a session can't be booked, as a stable code (for apps to translate)
// and an English message; null when it can be booked.
export const BLOCKER_MESSAGES = {
  CLOSED_FRIDAY: 'Chambers are closed on Fridays.',
  DATE_PASSED: 'That date has already passed.',
  TOO_FAR_AHEAD: `Bookings open ${BOOKING_WINDOW_DAYS} days in advance.`,
  SESSION_ENDED: 'This session has already ended today.',
};

export function bookingBlocker(date, session, now = dhakaNow()) {
  let code = null;
  if (dayOfWeek(date) === OFF_DAY) code = 'CLOSED_FRIDAY';
  else if (date < now.date) code = 'DATE_PASSED';
  else if (date > addDays(now.date, BOOKING_WINDOW_DAYS)) code = 'TOO_FAR_AHEAD';
  else if (date === now.date && now.minutes >= session.end) code = 'SESSION_ENDED';
  return code && { code, message: BLOCKER_MESSAGES[code] };
}

// Adds `estimated_arrival` to an appointment row booked as a chamber serial.
export function withEstimatedArrival(row) {
  const time = row.serial_no && row.session_time && parseSessionTime(row.session_time);
  return time ? { ...row, estimated_arrival: estimatedArrival(time.start, row.serial_no) } : row;
}
