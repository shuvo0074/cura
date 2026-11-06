// Helpers for asking an ambulance through Cura. Times are Dhaka time
// (UTC+6, no daylight saving), whatever the visitor's own clock says.
const DHAKA_OFFSET_MS = 6 * 3_600_000;
// The API accepts pickups up to 7 days ahead.
export const MAX_DAYS_AHEAD = 7;

// A Date as the value of an <input type="datetime-local"> in Dhaka time: "2026-11-06T18:30".
export function dhakaInputValue(date) {
  return new Date(date.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 16);
}

// "2026-11-06T18:30" read as Dhaka time → an ISO instant, or null when it is not a time.
export function dhakaInputToIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value ?? '')) return null;
  const at = new Date(`${value}:00+06:00`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

// The earliest and latest pickup the form offers.
export function pickupRange(now = new Date()) {
  return {
    min: dhakaInputValue(now),
    max: dhakaInputValue(new Date(now.getTime() + MAX_DAYS_AHEAD * 86_400_000)),
  };
}

// Requests still waiting for, or with, the ambulance.
export const isOpenRequest = request => request.status === 'new' || request.status === 'accepted';

// Open requests first, each group newest first (the API sends newest first).
export const sortRequests = requests => [...requests.filter(isOpenRequest), ...requests.filter(r => !isOpenRequest(r))];

// The i18n key for an error from the ambulance request API, by its code.
export function requestErrorKey(err) {
  const known = {
    ALREADY_REQUESTED: 'ar_err_already',
    TOO_MANY_REQUESTS: 'ar_err_too_many',
    DAILY_LIMIT: 'ar_err_daily',
    REQUEST_STATUS: 'ar_err_status',
    NOT_FOUND: 'ar_err_not_found',
    VALIDATION: 'ar_err_check',
  };
  return known[err?.code] ?? 'ar_err_generic';
}
