// 'YYYY-MM-DD' for a local calendar Date (the calendar's dates are local
// midnights already shifted to Dhaka's calendar day — see getDhakaNow).
export function toYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 'YYYY-MM-DD' (or ISO) -> Date at local midnight of that calendar day.
export function fromYmd(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 'YYYY-MM-DD' -> e.g. "Sat, 10 Oct 2026" (Bangla when the UI is in Bangla).
export function formatYmd(ymd, lang = 'en', options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', options).format(fromYmd(ymd));
}
