export const CARD = 'bg-white rounded-xl border border-gray-100 shadow-sm';
// Doctor profile surfaces: flat white, hairline border.
export const PANEL = 'bg-white rounded-2xl border border-gray-200/80';

// Whole years since a doctor started practising, or null if unknown.
export function yearsSince(year) {
  return year ? Math.max(0, new Date().getFullYear() - year) : null;
}

// "MBBS, MS (ENT), FCPS (Otolaryngology)" → ['MBBS', 'MS (ENT)', 'FCPS (Otolaryngology)'].
// Splits on commas and semicolons outside brackets, so "MD (Medicine, Cardiology)" stays whole.
export function splitDegrees(line) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of line || '') {
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

// Rows for the Qualifications section: the doctor's own entries (with
// institution and year), oldest first, else the listing's degree line split up.
export function degreeRows(items, fallbackLine) {
  if (items?.length) {
    return [...items]
      .sort((a, b) => (a.end_year ?? 9999) - (b.end_year ?? 9999) || a.id - b.id)
      .map(i => ({ key: i.id, title: i.title, institution: i.organization, year: i.end_year }));
  }
  return splitDegrees(fallbackLine).map((title, n) => ({ key: n, title, institution: null, year: null }));
}
