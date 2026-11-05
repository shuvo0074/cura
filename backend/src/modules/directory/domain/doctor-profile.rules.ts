import { DirectoryValidationError } from './errors';

/** Rules for what a doctor may put on their own profile. */
export const ITEM_KINDS = ['position', 'qualification', 'publication', 'membership', 'award'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

const MAX_EXPERTISE = 15;
const MAX_TREATMENTS = 30;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

function text(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length > max) return undefined;
  return cleaned || null;
}

function longText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (cleaned.length > max) return undefined;
  return cleaned || null;
}

function year(value: unknown, currentYear: number): number | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1950 && parsed <= currentYear + 1 ? parsed : undefined;
}

function taka(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000 ? parsed : undefined;
}

export function httpUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 300) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function list(value: unknown, maxItems: number, maxLength: number): string[] | undefined {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const cleaned = text(item, maxLength);
    if (cleaned === undefined) return undefined;
    if (cleaned && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      out.push(cleaned);
    }
  }
  return out;
}

export function slugify(name: unknown): string | null {
  const base = String(name ?? '')
    .toLowerCase()
    .replace(/^dr\.?\s*/, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  return base.length >= 2 ? `dr-${base}` : null;
}

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_RE.test(slug) && !slug.includes('--');
}

type Cleaner = (value: unknown, currentYear: number) => unknown;

const PROFILE_FIELDS: Record<string, [Cleaner, string]> = {
  headline: [(v) => text(v, 120), 'Headline can be at most 120 characters'],
  about: [(v) => longText(v, 3000), 'About can be at most 3000 characters'],
  practicingSince: [year, 'Enter the year you started practising'],
  fees: [taka, 'Enter the consultation fee in taka (up to 100000)'],
  followupFees: [taka, 'Enter the follow-up fee in taka (up to 100000)'],
  workplace: [(v) => text(v, 160), 'Workplace can be at most 160 characters'],
  languages: [(v) => text(v, 120), 'Languages can be at most 120 characters'],
  website: [httpUrl, 'Website must be a full link starting with https://'],
  clinicalExpertise: [
    (v) => list(v, MAX_EXPERTISE, 60),
    `Add up to ${MAX_EXPERTISE} areas of expertise, each at most 60 characters`,
  ],
  treatments: [
    (v) => list(v, MAX_TREATMENTS, 100),
    `Add up to ${MAX_TREATMENTS} treatments, each at most 100 characters`,
  ],
};

export type ProfilePatch = Record<string, unknown>;

/** Only keys present in the body are returned, so a partial update works. */
export function cleanProfilePatch(body: Record<string, unknown>, currentYear: number): ProfilePatch {
  const value: ProfilePatch = {};
  for (const [key, [clean, message]] of Object.entries(PROFILE_FIELDS)) {
    if (!(key in body)) continue;
    const cleaned = clean(body[key], currentYear);
    if (cleaned === undefined) throw new DirectoryValidationError(message);
    value[key] = cleaned;
  }
  if ('slug' in body) {
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    if (!isValidSlug(slug)) {
      throw new DirectoryValidationError(
        'Profile link must be 3–60 characters: lowercase letters, numbers and single hyphens',
      );
    }
    value.slug = slug;
  }
  return value;
}

export interface CleanItem {
  kind: ItemKind;
  title: string;
  organization: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
}

export function cleanItem(body: Record<string, unknown>, currentYear: number): CleanItem {
  const kind = body.kind as ItemKind;
  if (!ITEM_KINDS.includes(kind)) throw new DirectoryValidationError('Unknown entry type');
  const title = text(body.title, 160);
  if (!title) throw new DirectoryValidationError('Title is required (at most 160 characters)');
  const organization = text(body.organization, 160);
  const location = text(body.location, 120);
  const description = longText(body.description, 600);
  const url = httpUrl(body.url);
  const startYear = year(body.startYear, currentYear);
  const endYear = year(body.endYear, currentYear);
  const isCurrent = kind === 'position' && Boolean(body.isCurrent);
  if (organization === undefined || location === undefined || description === undefined) {
    throw new DirectoryValidationError('One of the fields is too long');
  }
  if (url === undefined) throw new DirectoryValidationError('Link must start with https://');
  if (startYear === undefined || endYear === undefined) {
    throw new DirectoryValidationError('Years must be between 1950 and next year');
  }
  if (startYear && endYear && endYear < startYear) {
    throw new DirectoryValidationError('End year must be after the start year');
  }
  if (kind === 'position' && !startYear) throw new DirectoryValidationError('Add the year you started');
  return {
    kind,
    title,
    organization,
    location,
    description,
    url,
    startYear,
    endYear: isCurrent ? null : endYear,
    isCurrent,
  };
}

interface CompletenessProfile {
  photo?: unknown;
  headline?: unknown;
  about?: string | null;
  clinicalExpertise?: string[] | null;
  practicingSince?: unknown;
  languages?: unknown;
}

const CHECKS: [string, (profile: CompletenessProfile, kinds: Set<string>) => boolean][] = [
  ['photo', (p) => Boolean(p.photo)],
  ['headline', (p) => Boolean(p.headline)],
  ['about', (p) => (p.about ?? '').length >= 150],
  ['expertise', (p) => (p.clinicalExpertise ?? []).length >= 3],
  ['practicing_since', (p) => Boolean(p.practicingSince)],
  ['position', (_p, kinds) => kinds.has('position')],
  ['qualification', (_p, kinds) => kinds.has('qualification')],
  ['languages', (p) => Boolean(p.languages)],
];

export function completeness(profile: CompletenessProfile, items: { kind: string }[]) {
  const kinds = new Set(items.map((item) => item.kind));
  const missing = CHECKS.filter(([, done]) => !done(profile, kinds)).map(([key]) => key);
  return { percent: Math.round(((CHECKS.length - missing.length) / CHECKS.length) * 100), missing };
}
