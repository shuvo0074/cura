import { expect, type Page } from '@playwright/test';

export const API = process.env.CURA_API_URL ?? 'http://localhost:3000/api';
export const PRACTICE_ID = '11111111-1111-4111-8111-111111111111';

/** Seeded accounts (backend/prisma/seed.ts). */
export const ACCOUNTS = {
  admin: { identifier: 'admin@cura.local', password: 'CuraAdmin123', name: 'Shahnaz Rahman' },
  doctor: { identifier: 'doctor@cura.local', password: 'CuraDoctor123' },
  desk: { identifier: 'desk@cura.local', password: 'CuraDesk123' },
} as const;

export type Role = keyof typeof ACCOUNTS;

/**
 * Console noise that is expected and not a UI fault: the refresh-cookie probe
 * on a cold load answers 401, and Vite's dev CSP meta tag carries a directive
 * browsers ignore.
 */
const BENIGN = [/401 \(Unauthorized\)/, /frame-ancestors/, /Download the React DevTools/];

/** Collects uncaught errors and console errors for the page's lifetime. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !BENIGN.some((re) => re.test(m.text()))) errors.push(m.text());
  });
  return errors;
}

/**
 * A sidebar entry by label. Unfinished modules carry a "soon" badge that is
 * part of the button's accessible name, so match the label plus that suffix.
 */
export function navButton(page: Page, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page
    .getByRole('navigation', { name: 'Modules' })
    .getByRole('button', { name: new RegExp(`^${escaped}( soon| part)?$`) });
}

export async function openModule(page: Page, label: string): Promise<void> {
  await navButton(page, label).click();
}

/**
 * Bearer token for direct API setup calls (creating fixtures, not asserting),
 * minted from the page's own session rather than a fresh login, which is
 * throttled. Refresh rotates the cookie inside the same context, so the page
 * keeps working.
 */
export async function apiToken(page: Page): Promise<string> {
  const res = await page.context().request.post(`${API}/auth/refresh`);
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}

/** A unique-enough Bangladeshi mobile number for throwaway fixtures. */
export function testMobile(prefix = '0199'): string {
  return `${prefix}${String(Date.now()).slice(-7)}`;
}

/**
 * Candidate start times for a throwaway booking: the next 10-minute
 * boundaries from now, today only. Earlier runs leave their bookings behind
 * and the API rightly refuses an overlap, so callers walk this list until
 * one is accepted.
 */
export function freeSlotCandidates(count = 30): Date[] {
  const first = new Date();
  first.setSeconds(0, 0);
  first.setMinutes(Math.ceil(first.getMinutes() / 10) * 10);
  const end = new Date();
  end.setHours(23, 50, 0, 0);
  const out: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = new Date(first.getTime() + i * 10 * 60_000);
    if (at > end) break;
    out.push(at);
  }
  return out;
}

/** The value a datetime-local input holds for a Date, in local time. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
