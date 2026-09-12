import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function verifyToken(req, res, next) {
  const token = req.cookies?.cura_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export function optionalAuth(req, _res, next) {
  const token = req.cookies?.cura_token;
  if (token) {
    try {
      req.user = jwt.verify(token, config.jwtSecret);
    } catch {
      req.user = null;
    }
  }
  next();
}
