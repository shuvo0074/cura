// Checks for the fields admins type by hand on doctors and hospitals. Each
// returns the tidied value (null when left blank) or throws a message
// suitable for a 400.

const blank = v => v === '' || v === undefined || v === null;

function numberIn(value, label, min, max) {
  if (blank(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be a number from ${min} to ${max}`);
  return n;
}

// 0–5, one decimal place (4.8, not 4.83).
export function rating(value) {
  const n = numberIn(value, 'Rating', 0, 5);
  return n === null ? null : Math.round(n * 10) / 10;
}

export const latitude = value => numberIn(value, 'Latitude', -90, 90);
export const longitude = value => numberIn(value, 'Longitude', -180, 180);

// A link to where the details were checked; only web pages.
export function sourceUrl(value) {
  if (blank(value)) return null;
  const s = String(value).trim();
  let url;
  try { url = new URL(s); } catch { throw new Error('Source link must be a full web address (https://…)'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Source link must start with http:// or https://');
  return s;
}

// The date the details were last checked against the source, YYYY-MM-DD.
export function checkedOn(value) {
  if (blank(value)) return null;
  const s = String(value).trim();
  const d = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new Error('Checked-on date must be a real date (YYYY-MM-DD)');
  }
  return s;
}
