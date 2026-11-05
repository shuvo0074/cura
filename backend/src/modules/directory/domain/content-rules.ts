import { DirectoryValidationError } from './errors';
import { normalizeBmdc } from './account-rules';

/** Checks for the fields admins type by hand. Each throws a message for a 400. */
type Body = Record<string, any>;

const blank = (v: unknown): boolean => v === '' || v === undefined || v === null;
const fail = (message: string): never => {
  throw new DirectoryValidationError(message);
};

function numberIn(value: unknown, label: string, min: number, max: number): number | null {
  if (blank(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    fail(`${label} must be a number from ${min} to ${max}`);
  }
  return parsed;
}

export function rating(value: unknown): number | null {
  const parsed = numberIn(value, 'Rating', 0, 5);
  return parsed === null ? null : Math.round(parsed * 10) / 10;
}
export const latitude = (value: unknown) => numberIn(value, 'Latitude', -90, 90);
export const longitude = (value: unknown) => numberIn(value, 'Longitude', -180, 180);

export function sourceUrl(value: unknown): string | null {
  if (blank(value)) return null;
  const trimmed = String(value).trim();
  let url: URL | null = null;
  try {
    url = new URL(trimmed);
  } catch {
    fail('Source link must be a full web address (https://…)');
  }
  if (!['http:', 'https:'].includes(url!.protocol)) fail('Source link must start with http:// or https://');
  return trimmed;
}

export function checkedOn(value: unknown): Date | null {
  if (blank(value)) return null;
  const trimmed = String(value).trim();
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== trimmed
  ) {
    fail('Checked-on date must be a real date (YYYY-MM-DD)');
  }
  return parsed;
}

const text = (v: unknown, max = 300): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

function numberOrNull(value: unknown): number | null {
  if (blank(value)) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function feeOrNull(value: unknown, label: string): number | null {
  const parsed = numberOrNull(value);
  if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000)) {
    fail(`${label} must be a whole number of taka up to 100000`);
  }
  return parsed;
}

/** A chamber schedule: a list of entries. Booking and hospital pages read it. */
export function weeklySchedule(value: unknown): Body[] {
  if (value === null || value === undefined || value === '') return [];
  if (!Array.isArray(value) || value.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    fail('Weekly schedule must be a list of chamber sessions');
  }
  return value as Body[];
}

function requireFields(body: Body, required: Record<string, string>): void {
  for (const [key, label] of Object.entries(required)) {
    if (!body[key] || !String(body[key]).trim()) fail(`${label} is required`);
  }
}

/** A listing as admins enter it. A missing field clears it: PATCH is a full replace. */
export function adminDoctor(body: Body) {
  requireFields(body, { name: 'Name', specialty: 'Specialty' });
  let bmdcNo: string | null = null;
  if (!blank(body.bmdcNo)) {
    bmdcNo = normalizeBmdc(body.bmdcNo);
    if (!bmdcNo) fail('Enter the BMDC registration number, e.g. A-12345');
  }
  const hospitalId = text(body.hospitalId);
  if (hospitalId && !UUID.test(hospitalId)) fail('Choose a hospital from the list');
  return {
    name: String(body.name).trim(),
    specialty: String(body.specialty).trim(),
    department: text(body.department),
    experience: text(body.experience),
    chamber: text(body.chamber),
    fees: feeOrNull(body.fees, 'Consultation fee'),
    followupFees: feeOrNull(body.followupFees, 'Follow-up fee'),
    city: text(body.city),
    hospitalId,
    phone: text(body.phone),
    photo: text(body.photo, 500),
    rating: rating(body.rating),
    about: text(body.about, 5000),
    lat: latitude(body.lat),
    lng: longitude(body.lng),
    website: text(body.website),
    bmdcNo,
    education: text(body.education),
    languages: text(body.languages),
    consultingHours: text(body.consultingHours),
    address: text(body.address),
    clinicalExpertise: toList(body.clinicalExpertise),
    treatments: toList(body.treatments),
    division: text(body.division),
    workplace: text(body.workplace),
    gender: ['male', 'female'].includes(body.gender) ? (body.gender as string) : null,
    sourceUrl: sourceUrl(body.source_url),
    verifiedOn: checkedOn(body.verified_on),
  };
}

const HOSPITAL_TYPES = ['hospital', 'diagnostic', 'clinic', 'online'];
const TEST_CATEGORIES = ['blood', 'imaging', 'cardiac'];
const KEY = /^[a-z][a-z0-9_]{0,40}$/;

const bedCount = (value: unknown): number | null => {
  if (blank(value)) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) fail('bed counts must be whole numbers');
  return parsed;
};

/** Extras are returned only when sent, so an older client cannot wipe them. */
function hospitalExtras(body: Body): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('type' in body) {
    if (body.type && !HOSPITAL_TYPES.includes(body.type)) fail(`type must be one of ${HOSPITAL_TYPES.join(', ')}`);
    out.type = body.type || null;
  }
  if (body.services !== null && body.services !== undefined) {
    if (!Array.isArray(body.services)) fail('services must be a list');
    const seen = new Set<string>();
    out.services = (body.services as Body[])
      .filter((service) => {
        if (!service || !KEY.test(service.key) || seen.has(service.key)) return false;
        seen.add(service.key);
        return true;
      })
      .map((service) => ({ key: service.key, hours: text(service.hours, 80) }));
  }
  if ('beds' in body) {
    if (body.beds === null || body.beds === undefined) out.beds = null;
    else {
      const beds = {
        general: bedCount(body.beds.general),
        cabin: bedCount(body.beds.cabin),
        icu: bedCount(body.beds.icu),
      };
      out.beds = Object.values(beds).every((count) => count === null) ? null : beds;
    }
  }
  if (body.tests !== null && body.tests !== undefined) {
    if (!Array.isArray(body.tests)) fail('tests must be a list');
    out.tests = (body.tests as Body[])
      .filter((test) => text(test?.name))
      .map((test) => {
        const price = blank(test.price) ? null : Number(test.price);
        if (price !== null && (!Number.isFinite(price) || price < 0)) {
          fail(`price for "${test.name}" must be a number`);
        }
        if (!TEST_CATEGORIES.includes(test.category)) {
          fail(`category for "${test.name}" must be one of ${TEST_CATEGORIES.join(', ')}`);
        }
        const clean: Body = {
          name: text(test.name, 120),
          category: test.category,
          price: price === null ? null : Math.round(price),
        };
        const source = sourceUrl(test.source_url);
        if (source) {
          clean.source_url = source;
          clean.source_checked_on = checkedOn(test.source_checked_on)?.toISOString().slice(0, 10) ?? null;
          clean.source_test_name = text(test.source_test_name, 120);
        }
        return clean;
      });
  }
  for (const [field, target] of [['facilities', 'facilities'], ['payment_methods', 'paymentMethods']] as const) {
    if (body[field] !== null && body[field] !== undefined) {
      if (!Array.isArray(body[field])) fail(`${field} must be a list`);
      out[target] = [...new Set((body[field] as string[]).filter((key) => KEY.test(key)))];
    }
  }
  if ('opening_hours' in body) out.openingHours = text(body.opening_hours, 120);
  if ('visiting_hours' in body) out.visitingHours = text(body.visiting_hours, 120);
  return out;
}

export function adminHospital(body: Body) {
  const extras = hospitalExtras(body);
  requireFields(body, { name: 'Name', location: 'City / location' });
  return {
    name: String(body.name).trim(),
    location: String(body.location).trim(),
    address: text(body.address),
    hotline: text(body.hotline),
    photo: text(body.photo, 500),
    lat: latitude(body.lat),
    lng: longitude(body.lng),
    website: text(body.website),
    division: text(body.division),
    description: text(body.description, 5000),
    sourceUrl: sourceUrl(body.source_url),
    verifiedOn: checkedOn(body.verified_on),
    ...extras,
  };
}

export const AMBULANCE_CATEGORIES = ['ac', 'non_ac', 'freezer', 'icu'];
export const AMBULANCE_FEATURES = ['24_hours', 'oxygen', 'medical_team', 'interdistrict'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function wholeTaka(value: unknown, label: string): number {
  const parsed = Number(value);
  if (blank(value) || !Number.isInteger(parsed) || parsed < 0) fail(`${label} must be a whole number of taka`);
  return parsed;
}

export function fareRanges(value: Body | undefined, categories = AMBULANCE_CATEGORIES, all = false) {
  const out: Record<string, { min: number; max: number }> = {};
  for (const category of categories) {
    const range = value?.[category];
    if (!all && blank(range?.min) && blank(range?.max)) continue;
    const label = category.replace('_', '-').toUpperCase();
    const min = wholeTaka(range?.min, `${label} lowest fare`);
    const max = wholeTaka(range?.max, `${label} highest fare`);
    if (min > max) fail(`${label} lowest fare can't be more than the highest`);
    out[category] = { min, max };
  }
  return out;
}

const pick = (list: unknown, allowed: string[], label: string): string[] => {
  if (!Array.isArray(list)) fail(`${label} must be a list`);
  return allowed.filter((item) => (list as unknown[]).includes(item));
};

export function ambulanceVendor(body: Body) {
  const name = text(body.name, 120);
  if (!name) fail('Name is required');
  const phones = (Array.isArray(body.phones) ? body.phones : String(body.phones ?? '').split(','))
    .map((phone: unknown) => String(phone).replace(/[\s-]/g, ''))
    .filter(Boolean);
  if (!phones.length) fail('At least one phone number is required');
  const bad = phones.find((phone: string) => !/^\+?\d{3,15}$/.test(phone));
  if (bad) fail(`"${bad}" is not a phone number`);
  const categories = pick(body.categories ?? [], AMBULANCE_CATEGORIES, 'Ambulance types');
  if (!categories.length) fail('Choose at least one ambulance type');
  const areas = body.service_areas ?? [];
  if (!Array.isArray(areas) || areas.some((area) => !SLUG.test(area))) {
    fail('Service areas must be a list of areas');
  }
  if (body.base_area && !SLUG.test(body.base_area)) fail('Base area is not a known area');
  return {
    name: name!,
    nameBn: text(body.name_bn, 120),
    baseArea: (body.base_area as string) || null,
    address: text(body.address),
    addressBn: text(body.address_bn),
    phones,
    categories,
    features: pick(body.features ?? [], AMBULANCE_FEATURES, 'Services'),
    dhakaWide: body.dhaka_wide === true,
    serviceAreas: [...new Set(areas as string[])],
    fares: fareRanges(body.fares, categories),
    sourceUrl: sourceUrl(body.source_url),
    sourceCheckedOn: checkedOn(body.source_checked_on),
  };
}

export function sampleTestPrices(list: unknown) {
  if (!Array.isArray(list)) fail('Sample prices must be a list');
  const seen = new Set<string>();
  return (list as Body[])
    .filter((item) => text(item?.name))
    .map((item) => {
      const name = text(item.name, 120)!;
      if (seen.has(name.toLowerCase())) fail(`"${name}" is listed twice`);
      seen.add(name.toLowerCase());
      if (!TEST_CATEGORIES.includes(item.category)) {
        fail(`Category for "${name}" must be one of ${TEST_CATEGORIES.join(', ')}`);
      }
      return { name, category: item.category as string, price: wholeTaka(item.price, `Price for "${name}"`) };
    });
}

/** An uploaded file (a site path) or a web address. */
export function imageRef(value: unknown): string | null {
  if (blank(value)) return null;
  const trimmed = String(value).trim();
  return trimmed.startsWith('/') && !trimmed.startsWith('//') ? trimmed : sourceUrl(trimmed);
}

const imageOrFail = (value: unknown, message: string): string | null => {
  try {
    return imageRef(value);
  } catch {
    return fail(message);
  }
};

export function catalogEntry(body: Body, options: { icon?: boolean; specialties?: boolean }) {
  const name = text(body.name, 80);
  if (!name) fail('Name is required');
  if (!Array.isArray(body.tags ?? [])) fail('Tags must be a list');
  const tags = [
    ...new Set(((body.tags ?? []) as unknown[]).map((tag) => text(String(tag), 40)).filter(Boolean) as string[]),
  ].slice(0, 6);
  const entry: Body = {
    name,
    nameBn: text(body.name_bn, 80),
    description: text(body.description, 500),
    tags,
    image: imageOrFail(body.image, 'Image must be an uploaded file or a full web address (https://…)'),
  };
  if (options.icon) entry.icon = text(body.icon, 8);
  if (options.specialties) {
    if (!Array.isArray(body.specialties ?? [])) fail('Specialties must be a list');
    entry.specialties = [
      ...new Set(((body.specialties ?? []) as unknown[]).map((s) => text(String(s), 80)).filter(Boolean) as string[]),
    ];
  }
  return entry;
}

export function urlSlug(name: string): string {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const DIVISIONS = ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Sylhet', 'Barishal', 'Rangpur', 'Mymensingh'];
const TEXT_KEY = /^[a-z0-9_]{1,80}$/;

const phoneNumber = (value: unknown, label: string): string => {
  const phone = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\+?\d{3,15}$/.test(phone)) fail(`${label} must be a phone number`);
  return phone;
};

const required = (value: unknown, label: string, max: number): string => {
  const cleaned = text(value, max);
  if (!cleaned) fail(`${label} is required`);
  return cleaned!;
};

/** { en: { key: "text" | null }, bn: {…} }. Null restores the built-in wording. */
export function siteTextPatch(patch: Body | undefined) {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [lang, entries] of Object.entries(patch ?? {})) {
    if (!['en', 'bn'].includes(lang)) fail(`Unknown language "${lang}"`);
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) fail('Text edits must be grouped by key');
    const group: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entries as Body)) {
      if (!TEXT_KEY.test(key)) fail(`"${key}" is not a text key`);
      if (value === null) group[key] = null;
      else if (key === 'faq_items') {
        if (!Array.isArray(value) || value.length > 30) fail('FAQ must be a list of up to 30 questions');
        group[key] = (value as Body[]).map((item, i) => ({
          q: required(item?.q, `FAQ question ${i + 1}`, 300),
          a: required(item?.a, `FAQ answer ${i + 1}`, 2000),
        }));
      } else {
        if (typeof value !== 'string' || !value.trim()) fail(`Text for "${key}" can't be empty; reset it instead`);
        group[key] = (value as string).slice(0, 2000);
      }
    }
    out[lang] = group;
  }
  return out;
}

const shortcut = (item: Body, label: string) => {
  if (!SLUG.test(item?.slug ?? '')) fail(`${label}: choose a page`);
  return {
    slug: item.slug as string,
    en: required(item.en, `${label} English label`, 40),
    bn: required(item.bn, `${label} Bangla label`, 40),
  };
};

export function homeContent(body: Body | undefined) {
  const list = (value: unknown, max: number, label: string) => {
    if (!Array.isArray(value)) fail(`${label} must be a list`);
    if ((value as unknown[]).length > max) fail(`${label} can have at most ${max}`);
    return (value as Body[]).map((item, i) => shortcut(item, `${label} ${i + 1}`));
  };
  const divisions = body?.divisions;
  if (
    !Array.isArray(divisions) ||
    divisions.length !== DIVISIONS.length ||
    DIVISIONS.some((name) => !divisions.some((d: Body) => d?.name === name))
  ) {
    fail('Divisions must list each of the 8 divisions once');
  }
  return {
    popular_specialties: list(body!.popular_specialties, 12, 'Popular specialty'),
    common_problems: list(body!.common_problems, 16, 'Common problem'),
    divisions: DIVISIONS.map((name) => {
      const division = (divisions as Body[]).find((d) => d.name === name)!;
      return {
        name,
        bn: required(division.bn, `${name} Bangla name`, 40),
        photo: imageOrFail(division.photo, `${name} photo must be an upload or a web address`),
        alt: text(division.alt, 160),
      };
    }),
  };
}

export function contactNumbers(body: Body | undefined) {
  return {
    emergency: phoneNumber(body?.emergency, 'Emergency number'),
    health_line: phoneNumber(body?.health_line, 'Health advice number'),
    hotline: phoneNumber(body?.hotline, 'Cura hotline'),
  };
}

const webLink = (value: unknown, label: string): string | null => {
  try {
    return sourceUrl(value);
  } catch {
    return fail(`${label} must be a full web address (https://…)`);
  }
};

export function photoCredits(list: unknown) {
  if (!Array.isArray(list) || list.length > 300) fail('Photo credits must be a list');
  return (list as Body[]).map((credit, i) => {
    const label = `Credit ${i + 1}`;
    const file = imageOrFail(credit?.file, `${label}: photo must be an upload or a web address`);
    if (!file) fail(`${label}: photo is required`);
    return {
      file,
      caption: required(credit.caption, `${label} caption`, 160),
      author: text(credit.author, 120),
      license: required(credit.license, `${label} licence`, 60),
      licenseUrl: webLink(credit.licenseUrl, `${label} licence link`),
      source: webLink(credit.source, `${label} source`),
      changes: text(credit.changes, 120),
    };
  });
}
