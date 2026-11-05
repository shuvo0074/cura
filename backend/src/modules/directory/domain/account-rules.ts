/** BMDC numbers: A-12345 for physicians, D-1234 for dental surgeons. */
export function normalizeBmdc(value: unknown): string | null {
  const match = typeof value === 'string' && value.trim().match(/^([AD])\s*-?\s*(\d{1,6})$/i);
  return match ? `${match[1]!.toUpperCase()}-${match[2]}` : null;
}

/** Stored mobiles are `+8801…`; the directory contract shows `01…`. */
export function toNationalPhone(mobile: string | null | undefined): string | null {
  return mobile ? mobile.replace(/^\+?88/, '') : null;
}

export function withDoctorPrefix(name: string): string {
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}
