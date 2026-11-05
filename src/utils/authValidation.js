// Instant feedback for the account forms. The API has the final say.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(email.trim()) && email.length <= 254;
}

// Returns an i18n key for the first problem, or null.
export function passwordProblemKey(password) {
  if (password.length < 10) return 'auth_err_password_len';
  if (password.length > 128) return 'auth_err_password_long';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return 'auth_err_password_mix';
  return null;
}

// "a12345", "A 12345", "A-12345" → "A-12345"; null if it isn't a BMDC number.
export function normalizeBmdc(value) {
  const m = value.trim().match(/^([AD])\s*-?\s*(\d{1,6})$/i);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
}

export function normalizeBdPhone(value) {
  const m = value.replace(/[\s-]/g, '').match(/^(?:\+?88)?(01[3-9]\d{8})$/);
  return m ? m[1] : null;
}

// Only same-site paths, so ?redirect= can't send someone to another site.
export function safeRedirect(path, fallback) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : fallback;
}
