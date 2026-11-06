/** Languages Cura Dashboard speaks. Saved on the account as `users.locale`. */
export type Locale = 'en' | 'bn';

export const LOCALES: readonly Locale[] = ['en', 'bn'];

/** Values a `{{name}}` placeholder can take. Numbers are shown in the current language's digits. */
export type TParams = Record<string, string | number>;

/**
 * One area's words.
 *
 * `en` is the source of truth and decides which keys exist. `bn` may leave a
 * key out (it then shows in English) but cannot add one English lacks.
 *
 * `messages` maps an English sentence that reaches the screen from elsewhere
 * (a validation rule in `@cura/shared`, an error from Cura API) to its Bangla.
 * Use it through `tm(message)`; an unknown sentence is shown as it is.
 */
export interface AreaDictionary<E extends Record<string, string>> {
  en: E;
  bn: { [K in keyof E]?: string };
  messages?: Record<string, string>;
}

/** Declares an area with typed keys. See `README.md` in this folder. */
export function defineArea<const E extends Record<string, string>>(dict: AreaDictionary<E>): AreaDictionary<E> {
  return dict;
}
