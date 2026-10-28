import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool, query } from '../db.js';
import { logger } from '../logger.js';
import { startSession, endSession, endAllSessions, loadUser } from '../sessions.js';
import { accountLimiter } from '../middleware/rateLimit.js';
import { normalizeEmail, isValidEmail, passwordProblem, normalizeBmdc, normalizeBdPhone } from '../validation.js';

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const BCRYPT_COST = 12;
// Compared against when the email is unknown, so a miss takes as long as a
// wrong password and response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

const loginFailures = accountLimiter('login-fail', { max: 5, windowMs: 15 * 60 * 1000 });
const otpRequests = accountLimiter('otp-request', { max: 3, windowMs: 10 * 60 * 1000 });

function validation(res, error) {
  return res.status(400).json({ error, code: 'VALIDATION' });
}

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    roles: u.roles, role: u.role, patientId: u.patientId, doctorId: u.doctorId,
  };
}

// The doctor's most recent verification request, for the dashboard banner.
async function latestVerification(userId) {
  const { rows } = await query(
    `SELECT v.status, v.kind, v.bmdc_no, v.review_note, v.submitted_at, v.reviewed_at,
            COALESCE(d.name, v.details->>'name') AS listing_name
     FROM doctor_verifications v LEFT JOIN doctors d ON d.id = v.doctor_id
     WHERE v.user_id = $1 ORDER BY v.submitted_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function sessionResponse(req, res, userId) {
  const session = await startSession(req, res, userId);
  return { ...publicUser(await loadUser(userId)), ...session };
}

async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function conflict(res, error, code) {
  return res.status(409).json({ error, code });
}

async function emailTaken(email) {
  const { rows } = await query(`SELECT 1 FROM users WHERE email = $1`, [email]);
  return rows.length > 0;
}

async function phoneTaken(phone) {
  const { rows } = await query(
    `SELECT 1 FROM users WHERE phone = $1 UNION SELECT 1 FROM patients WHERE phone = $1`, [phone]);
  return rows.length > 0;
}

// Shared checks for both registration forms. Returns the cleaned values,
// or sends the error response and returns null.
async function accountFields(req, res) {
  const email = normalizeEmail(req.body.email);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const { password } = req.body;
  if (name.length < 2 || name.length > 100) return validation(res, 'Please enter your full name'), null;
  if (!isValidEmail(email)) return validation(res, 'Please enter a valid email address'), null;
  const problem = passwordProblem(password);
  if (problem) return validation(res, problem), null;

  let phone = null;
  if (req.body.phone) {
    phone = normalizeBdPhone(req.body.phone);
    if (!phone) return validation(res, 'Please enter a valid Bangladeshi mobile number (01XXXXXXXXX)'), null;
  }
  if (await emailTaken(email)) return conflict(res, 'An account with this email already exists', 'EMAIL_TAKEN'), null;
  if (phone && await phoneTaken(phone)) return conflict(res, 'This mobile number is already registered', 'PHONE_TAKEN'), null;
  return { email, name, password, phone };
}

export async function registerPatient(req, res, next) {
  try {
    const fields = await accountFields(req, res);
    if (!fields) return;
    const hash = await bcrypt.hash(fields.password, BCRYPT_COST);
    const userId = await inTransaction(async client => {
      const { rows } = await client.query(
        `INSERT INTO users (email, phone, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING id`,
        [fields.email, fields.phone, hash, fields.name]
      );
      await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'patient')`, [rows[0].id]);
      await client.query(`INSERT INTO patients (user_id, phone, name) VALUES ($1, $2, $3)`, [rows[0].id, fields.phone, fields.name]);
      return rows[0].id;
    });
    logger.info({ event: 'patient_registered', userId }, 'Patient registered');
    res.status(201).json(await sessionResponse(req, res, userId));
  } catch (err) {
    next(err);
  }
}

const GENDERS = ['male', 'female'];

// A doctor signs up and asks to be verified. If their BMDC number matches a
// listing nobody manages yet, it's a claim on that listing; otherwise a new
// listing is created when an admin approves. Either way they get no access
// to a listing (or its patients) until approval.
export async function registerDoctor(req, res, next) {
  try {
    const bmdcNo = normalizeBmdc(req.body.bmdcNo);
    if (!bmdcNo) return validation(res, 'Enter your BMDC registration number, e.g. A-12345');
    const specialty = typeof req.body.specialty === 'string' ? req.body.specialty.trim() : '';
    if (!specialty || specialty.length > 80) return validation(res, 'Please choose your specialty');
    if (!req.body.phone) return validation(res, 'Mobile number is required for doctors');
    const gender = GENDERS.includes(req.body.gender) ? req.body.gender : null;
    const designation = typeof req.body.designation === 'string' ? req.body.designation.trim().slice(0, 120) : '';
    const workplace = typeof req.body.workplace === 'string' ? req.body.workplace.trim().slice(0, 160) : '';
    // Degrees as the doctor writes them after their name: MBBS, FCPS (Medicine)…
    const degrees = Array.isArray(req.body.degrees)
      ? [...new Set(req.body.degrees.filter(d => typeof d === 'string').map(d => d.trim().replace(/\s+/g, ' ')).filter(Boolean))]
      : [];
    if (degrees.length > 10 || degrees.some(d => d.length > 60)) return validation(res, 'Add up to 10 degrees, each at most 60 characters');

    const { rows: listings } = await query(
      `SELECT id, name, user_id FROM doctors WHERE upper(replace(bmdc_no, ' ', '')) = $1`, [bmdcNo]);
    if (listings.some(l => l.user_id)) {
      return conflict(res, 'A doctor account already manages the profile with this BMDC number. If this is you, contact support.', 'BMDC_CLAIMED');
    }

    const fields = await accountFields(req, res);
    if (!fields) return;
    const hash = await bcrypt.hash(fields.password, BCRYPT_COST);
    const listing = listings[0] || null;
    const details = { name: fields.name, specialty, gender, designation, workplace, phone: fields.phone, degrees };

    const userId = await inTransaction(async client => {
      const { rows } = await client.query(
        `INSERT INTO users (email, phone, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING id`,
        [fields.email, fields.phone, hash, fields.name]
      );
      const id = rows[0].id;
      await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'doctor')`, [id]);
      await client.query(
        `INSERT INTO doctor_verifications (user_id, doctor_id, kind, bmdc_no, details) VALUES ($1, $2, $3, $4, $5)`,
        [id, listing?.id || null, listing ? 'claim' : 'new', bmdcNo, details]
      );
      return id;
    });
    logger.info({ event: 'doctor_registered', userId, bmdcNo, claimDoctorId: listing?.id || null }, 'Doctor registered, awaiting verification');
    res.status(201).json({ ...(await sessionResponse(req, res, userId)), verification: await latestVerification(userId) });
  } catch (err) {
    next(err);
  }
}

async function passwordLogin(req, res, next, requiredRole) {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || typeof password !== 'string') return validation(res, 'email and password are required');

    const blocked = loginFailures.blocked(email);
    if (blocked) {
      logger.warn({ event: 'login_locked', email }, 'Login blocked after repeated failures');
      return loginFailures.tooMany(res, blocked.resetAt);
    }

    const { rows } = await query(
      `SELECT u.id, u.password_hash, u.status,
              ARRAY(SELECT role FROM user_roles r WHERE r.user_id = u.id) AS roles
       FROM users u WHERE u.email = $1`,
      [email]
    );
    const user = rows[0];
    const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
    const allowed = ok && user && user.status === 'active' && (!requiredRole || user.roles.includes(requiredRole));
    if (!allowed) {
      loginFailures.record(email);
      logger.warn({ event: 'login_failed', email, requiredRole }, 'Login failed');
      return res.status(401).json({ error: 'Incorrect email or password', code: 'INVALID_CREDENTIALS' });
    }

    loginFailures.reset(email);
    logger.info({ event: 'login', userId: user.id, roles: user.roles }, 'User logged in');
    const body = await sessionResponse(req, res, user.id);
    if (user.roles.includes('doctor') && !body.doctorId) body.verification = await latestVerification(user.id);
    res.json(body);
  } catch (err) {
    next(err);
  }
}

export const login = (req, res, next) => passwordLogin(req, res, next);
// Older clients log in through role-specific endpoints.
export const doctorLogin = (req, res, next) => passwordLogin(req, res, next, 'doctor');
export const adminLogin = (req, res, next) => passwordLogin(req, res, next, 'admin');

export async function requestOtp(req, res, next) {
  try {
    const phone = normalizeBdPhone(req.body.phone);
    if (!phone) return validation(res, 'Please enter a valid Bangladeshi mobile number (01XXXXXXXXX)');
    const blocked = otpRequests.blocked(phone);
    if (blocked) return otpRequests.tooMany(res, blocked.resetAt);
    otpRequests.record(phone);

    const code = String(crypto.randomInt(100000, 1000000));
    // Only the newest code for a phone is usable.
    await query(`UPDATE otp_codes SET consumed_at = now() WHERE phone = $1 AND consumed_at IS NULL`, [phone]);
    await query(
      `INSERT INTO otp_codes (phone, code, purpose, expires_at)
       VALUES ($1, $2, 'login', now() + make_interval(mins => $3))`,
      [phone, code, OTP_TTL_MINUTES]
    );

    // DEV ONLY: no real SMS provider is configured for this build. The OTP is
    // logged and also returned directly in the response instead of being sent
    // by SMS, so the flow can be exercised end-to-end without a paid provider.
    logger.info({ event: 'otp_requested', phone, expiresInMinutes: OTP_TTL_MINUTES }, `[MOCK OTP] phone=${phone} code=${code}`);

    res.json({
      message: 'OTP generated',
      otp: code,
      devNote: 'Mock OTP: no SMS was sent. This code is shown here only because this is a dev/demo build.',
    });
  } catch (err) {
    next(err);
  }
}

// Phone OTP login for patients (used by the mobile app; the web uses email
// for the MVP). Creates the account on first login.
export async function verifyOtp(req, res, next) {
  try {
    const phone = normalizeBdPhone(req.body.phone);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : String(req.body.code ?? '');
    if (!phone || !code) return validation(res, 'phone and code are required');

    const { rows } = await query(
      `SELECT id, code, attempts FROM otp_codes
       WHERE phone = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    const otp = rows[0];
    const match = otp && otp.code.length === code.length
      && crypto.timingSafeEqual(Buffer.from(otp.code), Buffer.from(code));
    if (!match) {
      if (otp) {
        // Too many wrong guesses burns the code; the user must request a new one.
        await query(
          `UPDATE otp_codes SET attempts = attempts + 1,
             consumed_at = CASE WHEN attempts + 1 >= $2 THEN now() END
           WHERE id = $1`,
          [otp.id, OTP_MAX_ATTEMPTS]
        );
      }
      logger.warn({ event: 'otp_verify_failed', phone }, 'OTP verify failed: invalid or expired code');
      return res.status(400).json({ error: 'Invalid or expired code', code: 'OTP_INVALID' });
    }
    await query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [otp.id]);

    const userId = await inTransaction(async client => {
      let { rows: users } = await client.query(`SELECT id FROM users WHERE phone = $1`, [phone]);
      if (!users[0]) ({ rows: users } = await client.query(`INSERT INTO users (phone) VALUES ($1) RETURNING id`, [phone]));
      const id = users[0].id;
      await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'patient') ON CONFLICT DO NOTHING`, [id]);
      const { rowCount } = await client.query(
        `UPDATE patients SET user_id = $1 WHERE phone = $2 AND user_id IS NULL`, [id, phone]);
      if (!rowCount) {
        await client.query(
          `INSERT INTO patients (user_id, phone) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`, [id, phone]);
      }
      return id;
    });

    logger.info({ event: 'patient_login', userId, phone }, 'Patient logged in with OTP');
    res.json(await sessionResponse(req, res, userId));
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const body = publicUser(req.user);
    if (req.user.roles.includes('doctor')) body.verification = await latestVerification(req.user.id);
    res.json(body);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const problem = passwordProblem(newPassword);
    if (problem) return validation(res, problem);
    const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    if (!rows[0]?.password_hash || !(await bcrypt.compare(String(currentPassword ?? ''), rows[0].password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect', code: 'INVALID_CREDENTIALS' });
    }
    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [req.user.id, await bcrypt.hash(newPassword, BCRYPT_COST)]);
    // Sign out every other device; keep this one.
    await query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`, [req.user.id, req.user.sid]);
    logger.info({ event: 'password_changed', userId: req.user.id }, 'Password changed');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    await endSession(req, res, req.user?.sid);
    logger.info({ event: 'logout', userId: req.user?.id }, 'User logged out');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req, res, next) {
  try {
    await endAllSessions(req.user.id);
    await endSession(req, res, null);
    logger.info({ event: 'logout_all', userId: req.user.id }, 'User logged out everywhere');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
