import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// The web app sends the session as an httpOnly cookie; the mobile app keeps
// its token in the device keychain and sends it as a Bearer header.
function tokenFrom(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.cura_token;
}

export function verifyToken(req, res, next) {
  const token = tokenFrom(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session', code: 'SESSION_EXPIRED' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
    next();
  };
}

export function optionalAuth(req, _res, next) {
  const token = tokenFrom(req);
  if (token) {
    try {
      req.user = jwt.verify(token, config.jwtSecret);
    } catch {
      req.user = null;
    }
  }
  next();
}
