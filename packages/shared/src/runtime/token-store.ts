/**
 * Access-token custody.
 *
 * The token is held in a module-scoped variable — never `localStorage` or
 * `sessionStorage`. Web storage is readable by any script on the origin, so a
 * single XSS foothold or a compromised dependency would exfiltrate a bearer
 * token that remains valid until expiry.
 *
 * The long-lived refresh token is never visible to JavaScript at all: it lives
 * in an httpOnly cookie the browser attaches only to the refresh endpoint. A
 * page reload therefore restores the session via `/auth/refresh` rather than by
 * reading a stored credential.
 */

let accessToken: string | null = null;
let expiresAtMs = 0;

/** Refresh slightly early so a request is never sent with an expiring token. */
const EXPIRY_SKEW_MS = 30_000;

export const tokenStore = {
  set(token: string, expiresInSeconds: number): void {
    accessToken = token;
    expiresAtMs = Date.now() + expiresInSeconds * 1000;
  },

  get(): string | null {
    return accessToken;
  },

  clear(): void {
    accessToken = null;
    expiresAtMs = 0;
  },

  isExpired(): boolean {
    return !accessToken || Date.now() >= expiresAtMs - EXPIRY_SKEW_MS;
  },
};
