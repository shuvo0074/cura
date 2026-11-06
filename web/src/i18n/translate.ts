import { AREAS } from './areas';
import type { Locale, TParams } from './define-area';
import { formatNumber, intlLocale } from './format';

type Areas = typeof AREAS;

/** `count_one` / `count_other` are one key, `count`, chosen by the `count` param. */
type BaseKey<K> = K extends `${infer B}_one` ? B : K extends `${infer B}_other` ? B : K;

/** Every key, as `area.key`. Typos are compile errors. */
export type TranslationKey = {
  [A in keyof Areas]: `${A & string}.${BaseKey<keyof Areas[A]['en'] & string>}`;
}[keyof Areas];

type Dict = Record<string, string | undefined>;

const lookup = (locale: Locale, area: string, key: string): string | undefined => {
  const dict = (AREAS as unknown as Record<string, { en: Dict; bn: Dict }>)[area];
  return dict?.[locale][key];
};

/** One sentence, falling back to English, then to plural forms. */
function find(locale: Locale, area: string, key: string, count: number | undefined): string | undefined {
  if (count !== undefined) {
    const rule = new Intl.PluralRules(intlLocale(locale)).select(count);
    const plural =
      lookup(locale, area, `${key}_${rule}`) ?? lookup(locale, area, `${key}_other`) ?? lookup(locale, area, key);
    if (plural !== undefined) return plural;
  }
  return lookup(locale, area, key);
}

export function translate(locale: Locale, fullKey: TranslationKey | string, params?: TParams): string {
  const dot = fullKey.indexOf('.');
  const area = fullKey.slice(0, dot);
  const key = fullKey.slice(dot + 1);
  const count = typeof params?.count === 'number' ? params.count : undefined;

  const text =
    find(locale, area, key, count) ?? (locale === 'en' ? undefined : find('en', area, key, count));
  if (text === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${fullKey}`);
    return fullKey;
  }
  if (!params) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? formatNumber(value, locale) : value;
  });
}

let messageIndex: Map<string, string> | null = null;

/** English sentences from `@cura/shared` and Cura API that have a Bangla version. */
function messages(): Map<string, string> {
  if (!messageIndex) {
    messageIndex = new Map();
    for (const area of Object.values(AREAS) as Array<{ messages?: Record<string, string> }>) {
      for (const [english, bangla] of Object.entries(area.messages ?? {})) {
        messageIndex.set(normalise(english), bangla);
      }
    }
  }
  return messageIndex;
}

// "Enter your full name" and "Enter your full name." are the same sentence.
const normalise = (s: string) => s.trim().replace(/[.!]$/, '').toLowerCase();

/**
 * Shows an English sentence that came from outside the dashboard (validation,
 * Cura API) in the current language when a Bangla version is known; otherwise
 * as it came. `null` and `undefined` pass through, so it wraps optional errors.
 */
export function translateMessage<T extends string | null | undefined>(locale: Locale, message: T): T {
  if (locale === 'en' || !message) return message;
  const exact = messages().get(normalise(message));
  if (exact) return exact as T;
  // "Password must be at least 8 characters" style sentences with a number in them.
  const digits = message.match(/\d+/g);
  if (digits) {
    const shape = messages().get(normalise(message.replace(/\d+/g, '{{n}}')));
    if (shape) {
      let i = 0;
      return shape.replace(/\{\{n\}\}/g, () => formatNumber(Number(digits[i++]), locale)) as T;
    }
  }
  return message;
}
