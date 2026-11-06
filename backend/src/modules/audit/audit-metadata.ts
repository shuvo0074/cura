/**
 * Makes stored audit details safe to show.
 *
 * Audit rows are written by many services over time, so the reader cannot
 * trust that none ever stored a secret. Any key that looks like a password,
 * hash, token, one-time code or national ID is dropped, at any depth, and long
 * values are cut short.
 */
const SECRET_PARTS = ['password', 'passwd', 'hash', 'token', 'secret', 'otp', 'cookie', 'authorization', 'apikey', 'api_key', 'pepper', 'salt'];
const SECRET_EXACT = new Set(['code', 'pin', 'nid', 'nidnumber', 'jwt', 'session', 'sessionid', 'refresh', 'credentials']);

const MAX_DEPTH = 4;
const MAX_STRING = 300;
const MAX_ITEMS = 50;

export function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SECRET_EXACT.has(lower)) return true;
  if (lower.endsWith('code') && lower !== 'postcode' && lower !== 'countrycode') return true;
  return SECRET_PARTS.some((part) => lower.includes(part));
}

export function safeMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '…';
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => safeMetadata(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS)) {
      if (isSecretKey(key)) continue;
      out[key] = safeMetadata(item, depth + 1);
    }
    return out;
  }
  return null;
}
