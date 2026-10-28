// Account input rules. src/utils/authValidation.js mirrors these for the
// forms' instant feedback; the server's copy is the one that counts.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidEmail(email) {
  return EMAIL_RE.test(email) && email.length <= 254;
}

// At least 8 characters with a letter and a digit. bcrypt ignores bytes
// past 72, so longer passwords are refused rather than silently truncated.
export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  if (Buffer.byteLength(password) > 72) return 'Password must be at most 72 bytes';
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return 'Password must contain a letter and a number';
  return null;
}

// BMDC registration numbers: A-12345 for physicians, D-1234 for dental
// surgeons. Accepts "a12345", "A 12345", "A-12345"; returns "A-12345".
export function normalizeBmdc(value) {
  const m = typeof value === 'string' && value.trim().match(/^([AD])\s*-?\s*(\d{1,6})$/i);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
}

// Bangladeshi mobile: 01XXXXXXXXX, optionally with +88 / 88.
export function normalizeBdPhone(value) {
  const m = typeof value === 'string' && value.replace(/[\s-]/g, '').match(/^(?:\+?88)?(01[3-9]\d{8})$/);
  return m ? m[1] : null;
}
