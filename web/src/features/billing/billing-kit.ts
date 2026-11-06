import { formatNumber, type Locale } from '../../i18n';

/** English status labels. Screens show `t('billing.status.<STATUS>')`; kept for older callers. */
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PARTIALLY_PAID: 'Part paid',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

/** Invoice statuses that have a `billing.status.*` label. */
export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const isInvoiceStatus = (value: string): value is InvoiceStatus =>
  (INVOICE_STATUSES as readonly string[]).includes(value);

/** Payment methods; the label is `t('billing.method.<value>')`. */
export const PAYMENT_METHODS = ['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK_TRANSFER', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const isPaymentMethod = (value: string): value is PaymentMethod =>
  (PAYMENT_METHODS as readonly string[]).includes(value);

/**
 * Minor units (poisha) → a display string with two decimals ("1,250.00", "১,২৫০.০০").
 * Never used for arithmetic.
 */
export function money(minor: number, locale: Locale = 'en'): string {
  return formatNumber(minor / 100, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Bangla digits typed into an amount field become ASCII digits, so "১২৫০" parses. */
export const asciiDigits = (input: string): string =>
  input.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));

/**
 * Parses a typed amount into integer minor units.
 *
 * Rounds at the boundary so a float never reaches a currency field — every
 * amount crossing the wire is an integer number of poisha.
 */
export function toMinor(input: string): number {
  const value = Number(asciiDigits(input));
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
