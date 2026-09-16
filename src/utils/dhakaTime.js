const DOW_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Bangladesh Standard Time, computed client-side via Intl so it's correct
// regardless of the visitor's own machine timezone (matches the container's
// `Asia/Dhaka` system clock the backend runs on).
export function getDhakaNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type) => parts.find(p => p.type === type)?.value;
  const dow = DOW_MAP[get('weekday')];
  const minutes = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
  // Calendar date in the Dhaka timezone, as a local (timezone-agnostic) Date
  // at midnight — safe to feed into Date-based calendar math (getDay(),
  // month grids, etc.) without the visitor's own browser timezone skewing it.
  const date = new Date(parseInt(get('year'), 10), parseInt(get('month'), 10) - 1, parseInt(get('day'), 10));
  return { dow, minutes, date };
}

function parseClockTime(str) {
  const m = str.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + parseInt(m[2], 10);
}

// "08:00 AM - 11:00 AM" -> { start: 480, end: 660 } (minutes since midnight)
export function parseTimeRangeToMinutes(range) {
  const [startStr, endStr] = range.split('-').map(s => s.trim());
  return { start: parseClockTime(startStr), end: parseClockTime(endStr) };
}
