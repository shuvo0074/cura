import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const OTP_TTL_MINUTES = 5;
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Sets the session cookie, and returns the token for the mobile app, which
// can't rely on cookies and stores it in the device keychain. Web requests
// never get the token in the body, so page scripts can't read it.
function issueToken(req, res, payload) {
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('cura_token', token, COOKIE_OPTS);
  return req.get('x-cura-client') === 'mobile' ? { token } : {};
}

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestOtp(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required', code: 'VALIDATION' });

    const code = genOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await query(
      `INSERT INTO otp_codes (phone, code, purpose, expires_at) VALUES ($1, $2, 'login', $3)`,
      [phone, code, expiresAt]
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

export async function verifyOtp(req, res, next) {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'phone and code are required', code: 'VALIDATION' });

    const { rows } = await query(
      `SELECT * FROM otp_codes
       WHERE phone = $1 AND code = $2 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, code]
    );
    if (!rows[0]) {
      logger.warn({ event: 'otp_verify_failed', phone }, 'OTP verify failed: invalid or expired code');
      return res.status(400).json({ error: 'Invalid or expired code', code: 'OTP_INVALID' });
    }

    await query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [rows[0].id]);

    let { rows: patientRows } = await query(`SELECT * FROM patients WHERE phone = $1`, [phone]);
    let patient = patientRows[0];
    let isNewPatient = false;
    if (!patient) {
      const inserted = await query(
        `INSERT INTO patients (phone) VALUES ($1) RETURNING *`,
        [phone]
      );
      patient = inserted.rows[0];
      isNewPatient = true;
    }

    const session = issueToken(req, res, { sub: patient.id, role: 'patient', phone: patient.phone });
    logger.info({ event: 'patient_login', patientId: patient.id, phone, isNewPatient }, 'Patient logged in');
    res.json({ id: patient.id, phone: patient.phone, name: patient.name, role: 'patient', ...session });
  } catch (err) {
    next(err);
  }
}

export async function doctorLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required', code: 'VALIDATION' });

    const { rows } = await query(`SELECT * FROM doctors WHERE email = $1`, [email]);
    const doctor = rows[0];
    if (!doctor || !doctor.password_hash || !(await bcrypt.compare(password, doctor.password_hash))) {
      logger.warn({ event: 'doctor_login_failed', email }, 'Doctor login failed');
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const session = issueToken(req, res, { sub: doctor.id, role: 'doctor', name: doctor.name });
    logger.info({ event: 'doctor_login', doctorId: doctor.id, email }, 'Doctor logged in');
    res.json({ id: doctor.id, name: doctor.name, email: doctor.email, role: 'doctor', ...session });
  } catch (err) {
    next(err);
  }
}

export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required', code: 'VALIDATION' });

    const { rows } = await query(`SELECT * FROM admins WHERE email = $1`, [email]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      logger.warn({ event: 'admin_login_failed', email }, 'Admin login failed');
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const session = issueToken(req, res, { sub: admin.id, role: 'admin', name: admin.name });
    logger.info({ event: 'admin_login', adminId: admin.id, email }, 'Admin logged in');
    res.json({ id: admin.id, name: admin.name, email: admin.email, role: 'admin', ...session });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json(req.user);
}

export async function logout(req, res) {
  logger.info({ event: 'logout', userId: req.user?.sub, role: req.user?.role }, 'User logged out');
  res.clearCookie('cura_token');
  res.json({ ok: true });
}
