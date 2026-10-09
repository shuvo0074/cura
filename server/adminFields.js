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

// Ambulance types and services; the same lists as src/utils/ambulanceFilters.js
// (the API image doesn't include the web app's files).
export const AMBULANCE_CATEGORIES = ['ac', 'non_ac', 'freezer', 'icu'];
export const AMBULANCE_FEATURES = ['24_hours', 'oxygen', 'medical_team', 'interdistrict'];
const TEST_CATEGORIES = ['blood', 'imaging', 'cardiac'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const text = (v, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function wholeTaka(value, label) {
  const n = Number(value);
  if (blank(value) || !Number.isInteger(n) || n < 0) throw new Error(`${label} must be a whole number of taka`);
  return n;
}

// { ac: { min, max }, … } for the given categories. Blank rows are skipped
// unless `all` is set (the shared sample fares need every category).
export function fareRanges(value, categories = AMBULANCE_CATEGORIES, { all = false } = {}) {
  const out = {};
  for (const category of categories) {
    const range = value?.[category];
    if (!all && (blank(range?.min) && blank(range?.max))) continue;
    const label = category.replace('_', '-').toUpperCase();
    const min = wholeTaka(range?.min, `${label} lowest fare`);
    const max = wholeTaka(range?.max, `${label} highest fare`);
    if (min > max) throw new Error(`${label} lowest fare can't be more than the highest`);
    out[category] = { min, max };
  }
  return out;
}

const pick = (list, allowed, label) => {
  if (!Array.isArray(list)) throw new Error(`${label} must be a list`);
  return allowed.filter(item => list.includes(item));
};

// An ambulance vendor as admins enter it; throws a message for a 400.
export function ambulanceVendor(body) {
  const name = text(body.name, 120);
  if (!name) throw new Error('Name is required');
  const phones = (Array.isArray(body.phones) ? body.phones : String(body.phones ?? '').split(','))
    .map(p => String(p).replace(/[\s-]/g, '')).filter(Boolean);
  if (!phones.length) throw new Error('At least one phone number is required');
  const bad = phones.find(p => !/^\+?\d{3,15}$/.test(p));
  if (bad) throw new Error(`"${bad}" is not a phone number`);
  const categories = pick(body.categories ?? [], AMBULANCE_CATEGORIES, 'Ambulance types');
  if (!categories.length) throw new Error('Choose at least one ambulance type');
  const areas = (body.service_areas ?? []);
  if (!Array.isArray(areas) || areas.some(a => !SLUG.test(a))) throw new Error('Service areas must be a list of areas');
  if (body.base_area && !SLUG.test(body.base_area)) throw new Error('Base area is not a known area');
  return {
    name, name_bn: text(body.name_bn, 120), base_area: body.base_area || null,
    address: text(body.address), address_bn: text(body.address_bn),
    phones, categories, features: pick(body.features ?? [], AMBULANCE_FEATURES, 'Services'),
    dhaka_wide: body.dhaka_wide === true, service_areas: [...new Set(areas)],
    fares: fareRanges(body.fares, categories),
    source_url: sourceUrl(body.source_url), source_checked_on: checkedOn(body.source_checked_on),
  };
}

// The sample test price list: unique names, a known category and a price each.
export function sampleTestPrices(list) {
  if (!Array.isArray(list)) throw new Error('Sample prices must be a list');
  const seen = new Set();
  return list.filter(x => text(x?.name)).map(x => {
    const name = text(x.name, 120);
    if (seen.has(name.toLowerCase())) throw new Error(`"${name}" is listed twice`);
    seen.add(name.toLowerCase());
    if (!TEST_CATEGORIES.includes(x.category)) throw new Error(`Category for "${name}" must be one of ${TEST_CATEGORIES.join(', ')}`);
    return { name, category: x.category, price: wholeTaka(x.price, `Price for "${name}"`) };
  });
}
