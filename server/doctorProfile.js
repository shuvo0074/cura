// Rules for what a doctor may put on their own profile. Each clean* function
// returns { value } or { error } so controllers can answer 400 with a reason.

export const ITEM_KINDS = ['position', 'qualification', 'publication', 'membership', 'award'];
const MAX_EXPERTISE = 15;
const MAX_TREATMENTS = 30;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

function text(value, max) {
  if (value == null) return null;
  if (typeof value !== 'string') return undefined;
  const v = value.trim().replace(/\s+/g, ' ');
  if (v.length > max) return undefined;
  return v || null;
}

// Multi-line text: keeps paragraph breaks, trims each line.
function longText(value, max) {
  if (value == null) return null;
  if (typeof value !== 'string') return undefined;
  const v = value.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (v.length > max) return undefined;
  return v || null;
}

function year(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  const max = new Date().getFullYear() + 1;
  return Number.isInteger(n) && n >= 1950 && n <= max ? n : undefined;
}

// A fee in taka: a whole number up to ৳100,000, or null to clear it.
function taka(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100000 ? n : undefined;
}

export function httpUrl(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 300) return undefined;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function list(value, maxItems, maxLen) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) return undefined;
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const v = text(item, maxLen);
    if (v === undefined) return undefined;
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export function slugify(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/^dr\.?\s*/, '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  return base.length >= 2 ? `dr-${base}` : null;
}

export function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug) && !slug.includes('--');
}

// Fields a verified doctor edits themselves (PATCH /doctors/me/profile).
// Only keys present in the body are returned, so a partial update works.
const PROFILE_FIELDS = {
  headline: ['headline', v => text(v, 120), 'Headline can be at most 120 characters'],
  about: ['about', v => longText(v, 3000), 'About can be at most 3000 characters'],
  practicingSince: ['practicing_since', year, 'Enter the year you started practising'],
  fees: ['fees', taka, 'Enter the consultation fee in taka (up to 100000)'],
  followupFees: ['followup_fees', taka, 'Enter the follow-up fee in taka (up to 100000)'],
  workplace: ['workplace', v => text(v, 160), 'Workplace can be at most 160 characters'],
  languages: ['languages', v => text(v, 120), 'Languages can be at most 120 characters'],
  website: ['website', httpUrl, 'Website must be a full link starting with https://'],
  clinicalExpertise: ['clinical_expertise', v => list(v, MAX_EXPERTISE, 60), `Add up to ${MAX_EXPERTISE} areas of expertise, each at most 60 characters`],
  treatments: ['treatments', v => list(v, MAX_TREATMENTS, 100), `Add up to ${MAX_TREATMENTS} treatments, each at most 100 characters`],
};

export function cleanProfilePatch(body) {
  const value = {};
  for (const [key, [column, clean, message]] of Object.entries(PROFILE_FIELDS)) {
    if (!(key in body)) continue;
    const v = clean(body[key]);
    if (v === undefined) return { error: message };
    value[column] = v;
  }
  if ('slug' in body) {
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    if (!isValidSlug(slug)) return { error: 'Profile link must be 3–60 characters: lowercase letters, numbers and single hyphens' };
    value.slug = slug;
  }
  return { value };
}

export function cleanItem(body) {
  const kind = body.kind;
  if (!ITEM_KINDS.includes(kind)) return { error: 'Unknown entry type' };
  const title = text(body.title, 160);
  if (!title) return { error: 'Title is required (at most 160 characters)' };
  const organization = text(body.organization, 160);
  const location = text(body.location, 120);
  const description = longText(body.description, 600);
  const url = httpUrl(body.url);
  const startYear = year(body.startYear);
  const endYear = year(body.endYear);
  const isCurrent = kind === 'position' && Boolean(body.isCurrent);
  if ([organization, location, description].includes(undefined)) return { error: 'One of the fields is too long' };
  if (url === undefined) return { error: 'Link must start with https://' };
  if (startYear === undefined || endYear === undefined) return { error: 'Years must be between 1950 and next year' };
  if (startYear && endYear && endYear < startYear) return { error: 'End year must be after the start year' };
  if (kind === 'position' && !startYear) return { error: 'Add the year you started' };
  return {
    value: {
      kind, title, organization, location, description, url,
      start_year: startYear,
      end_year: isCurrent ? null : endYear,
      is_current: isCurrent,
    },
  };
}

// What a complete profile has, in the order the editor suggests filling it.
const CHECKS = [
  ['photo', p => Boolean(p.photo)],
  ['headline', p => Boolean(p.headline)],
  ['about', p => (p.about || '').length >= 150],
  ['expertise', p => (p.clinical_expertise || []).length >= 3],
  ['practicing_since', p => Boolean(p.practicing_since)],
  ['position', (_p, items) => items.some(i => i.kind === 'position')],
  ['qualification', (_p, items) => items.some(i => i.kind === 'qualification')],
  ['languages', p => Boolean(p.languages)],
];

export function completeness(profile, items) {
  const missing = CHECKS.filter(([, done]) => !done(profile, items)).map(([key]) => key);
  return { percent: Math.round(((CHECKS.length - missing.length) / CHECKS.length) * 100), missing };
}
