import { SITE_TEXT_BN, SITE_TEXT_BN_FAQ } from './site-text-bn';
import { SITE_TEXT_EN, SITE_TEXT_EN_FAQ } from './site-text-en';

export type Lang = 'en' | 'bn';
export type FaqItem = { q: string; a: string };

/** Admins' edits as the API stores them: text by key, plus an optional FAQ list. */
export type TextEdits = Record<string, string | FaqItem[]>;
export type SiteText = Record<Lang, TextEdits>;

export const LANGS: ReadonlyArray<readonly [Lang, string]> = [
  ['en', 'English'],
  ['bn', 'Bangla'],
];

/** The Cura Website's built-in wording, the same as its i18n files. */
export const BUILT_IN_TEXT: Record<Lang, Record<string, string>> = { en: SITE_TEXT_EN, bn: SITE_TEXT_BN };
export const BUILT_IN_FAQ: Record<Lang, FaqItem[]> = { en: SITE_TEXT_EN_FAQ, bn: SITE_TEXT_BN_FAQ };
