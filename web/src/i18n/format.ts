import type { Locale } from './define-area';

/**
 * Number, date, time and money formatting for each language.
 *
 * English uses `en-GB` (6 Nov 2026, 2:30 pm); Bangla uses `bn-BD`, which also
 * writes Bangla digits and lakh grouping (১,২৫,০০০). Get these through
 * `useT().fmt` in components; the plain functions are for code outside React.
 */
export const intlLocale = (locale: Locale): string => (locale === 'bn' ? 'bn-BD' : 'en-GB');

type DateInput = Date | string | number;

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/**
 * Taka, with the ৳ sign in front: "৳1,250" / "৳১,২৫০".
 * Whole amounts show no decimals unless `decimals` is given.
 */
export function formatMoney(amount: number, locale: Locale, decimals?: number): string {
  const digits = decimals ?? (Number.isInteger(amount) ? 0 : 2);
  const sign = amount < 0 ? '-' : '';
  return `${sign}৳${formatNumber(Math.abs(amount), locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Same as `formatMoney`, for amounts stored in poisha (minor units) like invoices. */
export const formatMoneyMinor = (minor: number, locale: Locale, decimals?: number): string =>
  formatMoney(minor / 100, locale, decimals);

/**
 * A date. `style` is a preset or any `Intl.DateTimeFormatOptions`:
 *   short  6 Nov 2026          ৬ নভে, ২০২৬
 *   medium Fri, 6 Nov 2026
 *   long   6 November 2026
 *   full   Friday, 6 November 2026
 */
export function formatDate(
  value: DateInput,
  locale: Locale,
  style: 'short' | 'medium' | 'long' | 'full' | Intl.DateTimeFormatOptions = 'short',
): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : style === 'medium'
        ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
        : style === 'long'
          ? { dateStyle: 'long' }
          : style === 'full'
            ? { dateStyle: 'full' }
            : style;
  return toDate(value).toLocaleDateString(intlLocale(locale), options);
}

/** Clock time on a 12-hour clock: "2:30 pm" / "২:৩০ PM". */
export function formatTime(value: DateInput, locale: Locale): string {
  return toDate(value).toLocaleTimeString(intlLocale(locale), { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "6 Nov 2026, 2:30 pm". */
export function formatDateTime(value: DateInput, locale: Locale): string {
  return `${formatDate(value, locale)}, ${formatTime(value, locale)}`;
}

/** A date span with shared parts collapsed: "25 – 31 Oct 2026". */
export function formatDateRange(
  from: DateInput,
  to: DateInput,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).formatRange(toDate(from), toDate(to));
}

/** Formatters bound to one language; what `useT().fmt` returns. */
export interface Formatters {
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  money: (amount: number, decimals?: number) => string;
  moneyMinor: (minor: number, decimals?: number) => string;
  date: (value: DateInput, style?: Parameters<typeof formatDate>[2]) => string;
  time: (value: DateInput) => string;
  dateTime: (value: DateInput) => string;
  dateRange: (from: DateInput, to: DateInput, options?: Intl.DateTimeFormatOptions) => string;
}

export function formattersFor(locale: Locale): Formatters {
  return {
    number: (value, options) => formatNumber(value, locale, options),
    money: (amount, decimals) => formatMoney(amount, locale, decimals),
    moneyMinor: (minor, decimals) => formatMoneyMinor(minor, locale, decimals),
    date: (value, style) => formatDate(value, locale, style),
    time: (value) => formatTime(value, locale),
    dateTime: (value) => formatDateTime(value, locale),
    dateRange: (from, to, options) => formatDateRange(from, to, locale, options),
  };
}
