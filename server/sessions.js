import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { config } from './config.js';

const SESSION_DAYS = 7;
const COOKIE = 'cura_token';

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

// The mobile app sends `x-cura-client: mobile` and keeps the token in the
// device keychain. Browsers always send Origin on POST, so a page script
// can't obtain the raw token by setting the header itself.
function isMobileClient(req) {
  return req.get('x-cura-client') === 'mobile' && !req.get('origin');
}

// Starts a session: a DB row (so it can be revoked) plus a signed token that
// names it. Returns { token } for the mobile app, {} for the web, whose
// token lives only in the httpOnly cookie.
export async function startSession(req, res, userId) {
  const mobile = isMobileClient(req);
  const { rows } = await query(
    `INSERT INTO sessions (user_id, client, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5)) RETURNING id`,
    [userId, mobile ? 'mobile' : 'web', req.get('user-agent')?.slice(0, 300) || null, req.ip, SESSION_DAYS]
  );
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
  const token = jwt.sign({ sid: rows[0].id, sub: userId }, config.jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, cookieOpts());
  return mobile ? { token } : {};
}

export function tokenFrom(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[COOKIE];
}

const ROLE_PRIORITY = ['admin', 'doctor', 'staff', 'ambulance_owner', 'ambulance_driver', 'patient'];

const USER_COLUMNS = `u.id, u.name, u.email, u.phone,
  ARRAY(SELECT role FROM user_roles r WHERE r.user_id = u.id) AS roles,
  (SELECT id FROM patients WHERE user_id = u.id) AS patient_id,
  (SELECT id FROM doctors WHERE user_id = u.id) AS doctor_id`;

function toUser(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    roles: r.roles,
    // Primary role, kept for clients that predate multiple roles.
    role: ROLE_PRIORITY.find(role => r.roles.includes(role)) || null,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
  };
}

export async function loadUser(userId) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [userId]);
  return rows[0] ? toUser(rows[0]) : null;
}

// The signed-in user for a token, read fresh from the database on every
// request so a revoked session or disabled account stops working at once.
export async function loadSession(token) {
  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
  if (!claims.sid) return null;
  const { rows } = await query(
    `SELECT s.id AS sid, ${USER_COLUMNS}
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'`,
    [claims.sid]
  );
  return rows[0] ? { ...toUser(rows[0]), sid: rows[0].sid } : null;
}

export async function endSession(req, res, sid) {
  if (sid) await query(`UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [sid]);
  res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined });
}

export async function endAllSessions(userId) {
  await query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}
