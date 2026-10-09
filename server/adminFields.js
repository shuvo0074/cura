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

// An image is an uploaded file (a /cura-media/… path) or a web address.
export function imageRef(value) {
  if (blank(value)) return null;
  const s = String(value).trim();
  return s.startsWith('/') && !s.startsWith('//') ? s : sourceUrl(s);
}

// A specialty or symptom as admins enter it; throws a message for a 400.
export function catalogEntry(body, { icon = false, specialties = false } = {}) {
  const name = text(body.name, 80);
  if (!name) throw new Error('Name is required');
  if (!Array.isArray(body.tags ?? [])) throw new Error('Tags must be a list');
  const tags = [...new Set((body.tags ?? []).map(t => text(String(t), 40)).filter(Boolean))].slice(0, 6);
  const entry = {
    name, name_bn: text(body.name_bn, 80), description: text(body.description, 500), tags,
    image: (() => { try { return imageRef(body.image); } catch { throw new Error('Image must be an uploaded file or a full web address (https://…)'); } })(),
  };
  if (icon) entry.icon = text(body.icon, 8);
  if (specialties) {
    if (!Array.isArray(body.specialties ?? [])) throw new Error('Specialties must be a list');
    entry.specialties = [...new Set((body.specialties ?? []).map(s => text(String(s), 80)).filter(Boolean))];
  }
  return entry;
}

// URL-safe page address from a name: "ENT & Head" → "ent-head".
export function slugify(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---- Site content (home page, site text, phone numbers, photo credits) ----

export const DIVISIONS = ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Sylhet', 'Barishal', 'Rangpur', 'Mymensingh'];
const TEXT_KEY = /^[a-z0-9_]{1,80}$/;
const phone = (value, label) => {
  const p = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\+?\d{3,15}$/.test(p)) throw new Error(`${label} must be a phone number`);
  return p;
};
const required = (value, label, max) => {
  const v = text(value, max);
  if (!v) throw new Error(`${label} is required`);
  return v;
};

// Site text edits: { en: { key: "text" | null }, bn: { … } }, null meaning
// "back to the built-in wording". The FAQ is a list of { q, a }.
export function siteTextPatch(patch) {
  const out = {};
  for (const [lang, entries] of Object.entries(patch ?? {})) {
    if (!['en', 'bn'].includes(lang)) throw new Error(`Unknown language "${lang}"`);
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Text edits must be grouped by key');
    out[lang] = {};
    for (const [key, value] of Object.entries(entries)) {
      if (!TEXT_KEY.test(key)) throw new Error(`"${key}" is not a text key`);
      if (value === null) out[lang][key] = null;
      else if (key === 'faq_items') {
        if (!Array.isArray(value) || value.length > 30) throw new Error('FAQ must be a list of up to 30 questions');
        out[lang][key] = value.map((item, i) => ({ q: required(item?.q, `FAQ question ${i + 1}`, 300), a: required(item?.a, `FAQ answer ${i + 1}`, 2000) }));
      } else {
        if (typeof value !== 'string' || !value.trim()) throw new Error(`Text for "${key}" can't be empty; reset it instead`);
        out[lang][key] = value.slice(0, 2000);
      }
    }
  }
  return out;
}

const shortcut = (item, label) => ({
  slug: (() => { if (!SLUG.test(item?.slug ?? '')) throw new Error(`${label}: choose a page`); return item.slug; })(),
  en: required(item.en, `${label} English label`, 40), bn: required(item.bn, `${label} Bangla label`, 40),
});

// The home page's picks: popular specialties, common problems, and a photo
// for each division.
export function homeContent(body) {
  const list = (value, max, label) => {
    if (!Array.isArray(value)) throw new Error(`${label} must be a list`);
    if (value.length > max) throw new Error(`${label} can have at most ${max}`);
    return value.map((item, i) => shortcut(item, `${label} ${i + 1}`));
  };
  if (!Array.isArray(body?.divisions) || body.divisions.length !== DIVISIONS.length
    || DIVISIONS.some(name => !body.divisions.some(d => d?.name === name))) {
    throw new Error('Divisions must list each of the 8 divisions once');
  }
  return {
    popular_specialties: list(body.popular_specialties, 12, 'Popular specialty'),
    common_problems: list(body.common_problems, 16, 'Common problem'),
    divisions: DIVISIONS.map(name => {
      const d = body.divisions.find(x => x.name === name);
      return {
        name, bn: required(d.bn, `${name} Bangla name`, 40),
        photo: (() => { try { return imageRef(d.photo); } catch { throw new Error(`${name} photo must be an upload or a web address`); } })(),
        alt: text(d.alt, 160),
      };
    }),
  };
}

export function contactNumbers(body) {
  return {
    emergency: phone(body?.emergency, 'Emergency number'),
    health_line: phone(body?.health_line, 'Health advice number'),
    hotline: phone(body?.hotline, 'Cura hotline'),
  };
}

const link = (value, label) => { try { return sourceUrl(value); } catch { throw new Error(`${label} must be a full web address (https://…)`); } };

// Attribution for photos used on the site (CC licences require it).
export function photoCredits(list) {
  if (!Array.isArray(list) || list.length > 300) throw new Error('Photo credits must be a list');
  return list.map((c, i) => {
    const label = `Credit ${i + 1}`;
    let file;
    try { file = imageRef(c?.file); } catch { throw new Error(`${label}: photo must be an upload or a web address`); }
    if (!file) throw new Error(`${label}: photo is required`);
    return {
      // Public-domain photos may have no known author.
      file, caption: required(c.caption, `${label} caption`, 160), author: text(c.author, 120),
      license: required(c.license, `${label} licence`, 60), licenseUrl: link(c.licenseUrl, `${label} licence link`),
      source: link(c.source, `${label} source`), changes: text(c.changes, 120),
    };
  });
}
