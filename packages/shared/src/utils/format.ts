import { businessRules } from '../config/app-config';
import { type VisitType, visitTypePrefix } from '../domain/enums';

/** Presentation helpers shared by web and mobile so formatting cannot diverge. */

/** `+8801712345678` → `+8801•••••5678`. Used wherever an OTP target is echoed. */
export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 6) return '•'.repeat(digits.length);
  return `${mobile.slice(0, 5)}${'•'.repeat(5)}${digits.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '•'.repeat(email.length);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'•'.repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

export function formatCuraId(sequence: number): string {
  return `${businessRules.patient.idPrefix}-${String(sequence).padStart(5, '0')}`;
}

export function visitLabel(name: string, visitType: VisitType): string {
  return `${visitTypePrefix[visitType]} · ${name}`;
}

/** Age from an ISO date. Returns null for absent or future dates. */
export function ageFromDateOfBirth(dob: string | null | undefined, now = new Date()): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime()) || born > now) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

/** "09:00" → minutes past midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Locale-aware initials fallback for avatars. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * Whether an encounter falls inside the privacy window and is therefore
 * readable without a fresh consent grant.
 */
export function isWithinPrivacyWindow(occurredAt: string, now = new Date()): boolean {
  const then = new Date(occurredAt).getTime();
  if (Number.isNaN(then)) return false;
  const days = (now.getTime() - then) / 86_400_000;
  return days <= businessRules.patient.privacyWindowDays;
}
