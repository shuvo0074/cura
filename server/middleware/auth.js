import { tokenFrom, loadSession } from '../sessions.js';

export async function verifyToken(req, res, next) {
  const token = tokenFrom(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
  try {
    req.user = await loadSession(token);
  } catch (err) {
    return next(err);
  }
  if (!req.user) return res.status(401).json({ error: 'Invalid or expired session', code: 'SESSION_EXPIRED' });
  next();
}

// Passes if the user holds any of the given roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.some(role => req.user.roles.includes(role))) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
    next();
  };
}

// A doctor account manages a listing only once an admin has linked it
// (created it, or approved their claim/registration). Until then there is
// no doctorId, and no access to that listing's patients.
export function requireLinkedDoctor(req, res, next) {
  if (!req.user?.doctorId) {
    return res.status(403).json({ error: 'Your doctor profile is awaiting verification', code: 'DOCTOR_NOT_VERIFIED' });
  }
  next();
}

export async function optionalAuth(req, _res, next) {
  const token = tokenFrom(req);
  if (!token) return next();
  try {
    req.user = await loadSession(token);
  } catch (err) {
    return next(err);
  }
  next();
}
