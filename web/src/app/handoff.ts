import type { AppError, AuthApi, AuthSession, Result } from '@cura/shared';
import { WEBSITE_URL } from '../config/env';

/**
 * One login across Cura Website and Cura Dashboard.
 *
 * The two front ends are different sites, so they cannot share the refresh
 * cookie. Instead the API hands out a single-use code that lasts a minute, and
 * the browser carries it across in the URL fragment. A fragment is never sent
 * to a server, so the code stays out of server logs and the Referer header.
 */
const FRAGMENT = /^#handoff=([A-Za-z0-9_-]{43})$/;

let redemption: Promise<Result<AuthSession, AppError>> | null = null;

/** Reads a handoff code from the address and removes it at once. */
function takeHandoffCode(): string | null {
  if (!window.location.hash.startsWith('#handoff=')) return null;
  const code = FRAGMENT.exec(window.location.hash)?.[1] ?? null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return code;
}

/**
 * Swaps a code in the address for a session, once per page load. StrictMode runs
 * the boot effect twice, and both runs must share the one attempt.
 * Answers null when the page was not opened with a code.
 */
export function redeemHandoffFromAddress(auth: AuthApi): Promise<Result<AuthSession, AppError>> | null {
  if (redemption) return redemption;
  const code = takeHandoffCode();
  if (code === null) return null;
  redemption = auth.redeemHandoff(code);
  return redemption;
}

/** Opens Cura Website logged in as the same person. Falls back to a plain link. */
export async function openWebsite(auth: AuthApi): Promise<void> {
  const created = await auth.createHandoff();
  window.location.assign(created.ok ? `${WEBSITE_URL}/#handoff=${created.value.code}` : `${WEBSITE_URL}/`);
}
