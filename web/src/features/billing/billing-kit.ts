export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PARTIALLY_PAID: 'Part paid',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_METHODS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'OTHER', label: 'Other' },
];

/** Minor units (poisha) → a display string. Never used for arithmetic. */
export function money(minor: number): string {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses a typed amount into integer minor units.
 *
 * Rounds at the boundary so a float never reaches a currency field — every
 * amount crossing the wire is an integer number of poisha.
 */
export function toMinor(input: string): number {
  const value = Number(input);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
