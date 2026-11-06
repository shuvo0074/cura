import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import type { AuthenticatedUser } from '@cura/shared';
import { useServices } from '../app/services';
import type { Locale, TParams } from './define-area';
import { formattersFor, type Formatters } from './format';
import { translate, translateMessage, type TranslationKey } from './translate';

const STORAGE_KEY = 'cura.locale';

interface I18nContextValue {
  locale: Locale;
  /** Changes the language on this device; `chooseLanguage` also saves it to the account. */
  setLocale: (locale: Locale) => void;
  /** True once someone picks a language on the login screen in this visit. */
  pickedBeforeLogin: MutableRefObject<boolean>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Storage can throw (private mode, blocked site data): the language then lasts for this visit only.
function readStored(): Locale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

function store(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Kept in memory only.
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStored);
  const pickedBeforeLogin = useRef(false);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    store(next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale, pickedBeforeLogin }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx;
}

export interface UseT {
  /** `t('area.key', { name: 'Rahima' })`. See README.md. */
  t: (key: TranslationKey, params?: TParams) => string;
  /** An English sentence from validation or Cura API, in the current language when known. */
  tm: <T extends string | null | undefined>(message: T) => T;
  /**
   * Like `t`, with React elements in some placeholders, so a bold name or a
   * link can sit where each language's word order puts it:
   * `rich('auth.codeSent', { length: 6 }, { to: <strong>{phone}</strong> })`.
   */
  rich: (key: TranslationKey, params: TParams | undefined, nodes: Record<string, ReactNode>) => ReactNode;
  locale: Locale;
  /** Dates, times, numbers and money in the current language. */
  fmt: Formatters;
}

/** The current language's words and formatters. */
export function useT(): UseT {
  const { locale } = useI18nContext();
  return useMemo(
    () => ({
      t: (key: TranslationKey, params?: TParams) => translate(locale, key, params),
      tm: <T extends string | null | undefined>(message: T) => translateMessage(locale, message),
      rich: (key: TranslationKey, params: TParams | undefined, nodes: Record<string, ReactNode>) => {
        // Placeholders named in `nodes` survive `translate` untouched, then become elements.
        const text = translate(locale, key, params);
        return text.split(/(\{\{\s*\w+\s*\}\})/).map((part, i) => {
          const name = /^\{\{\s*(\w+)\s*\}\}$/.exec(part)?.[1];
          return <Fragment key={i}>{name !== undefined && name in nodes ? nodes[name] : part}</Fragment>;
        });
      },
      locale,
      fmt: formattersFor(locale),
    }),
    [locale],
  );
}

/**
 * Switching language. Signed in, the choice is saved to the account so it
 * follows the person to another computer; before login it stays on this device.
 */
export function useLanguage() {
  const { locale, setLocale, pickedBeforeLogin } = useI18nContext();
  const { http } = useServices();

  const chooseLanguage = useCallback(
    (next: Locale, signedIn: boolean) => {
      setLocale(next);
      if (signedIn) {
        void http.request('/account/profile', { method: 'PATCH', body: { locale: next }, retry: false });
      } else {
        pickedBeforeLogin.current = true;
      }
    },
    [http, setLocale, pickedBeforeLogin],
  );

  /**
   * After login or session restore. At login, a language picked on the login
   * screen wins and is saved to the account; otherwise the account's saved
   * language is used.
   */
  const adoptAccountLanguage = useCallback(
    (user: AuthenticatedUser, atLogin: boolean) => {
      if (atLogin && pickedBeforeLogin.current) {
        pickedBeforeLogin.current = false;
        if (user.locale !== locale) {
          void http.request('/account/profile', { method: 'PATCH', body: { locale }, retry: false });
        }
        return;
      }
      if (user.locale === 'en' || user.locale === 'bn') setLocale(user.locale);
    },
    [http, locale, setLocale, pickedBeforeLogin],
  );

  return { locale, chooseLanguage, adoptAccountLanguage };
}
