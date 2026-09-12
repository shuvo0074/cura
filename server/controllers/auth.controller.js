import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { config } from '../config.js';

const OTP_TTL_MINUTES = 5;
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function issueToken(res, payload) {
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('cura_token', token, COOKIE_OPTS);
}

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestOtp(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const code = genOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await query(
      `INSERT INTO otp_codes (phone, code, purpose, expires_at) VALUES ($1, $2, 'login', $3)`,
      [phone, code, expiresAt]
    );

    // DEV ONLY: no real SMS provider is configured for this build. The OTP is
    // logged and also returned directly in the response instead of being sent
    // by SMS, so the flow can be exercised end-to-end without a paid provider.
    console.log(`[MOCK OTP] phone=${phone} code=${code} (expires in ${OTP_TTL_MINUTES}m)`);

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
    if (!phone || !code) return res.status(400).json({ error: 'phone and code are required' });

    const { rows } = await query(
      `SELECT * FROM otp_codes
       WHERE phone = $1 AND code = $2 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, code]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired code' });

    await query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [rows[0].id]);

    let { rows: patientRows } = await query(`SELECT * FROM patients WHERE phone = $1`, [phone]);
    let patient = patientRows[0];
    if (!patient) {
      const inserted = await query(
        `INSERT INTO patients (phone) VALUES ($1) RETURNING *`,
        [phone]
      );
      patient = inserted.rows[0];
    }

    issueToken(res, { sub: patient.id, role: 'patient', phone: patient.phone });
    res.json({ id: patient.id, phone: patient.phone, name: patient.name, role: 'patient' });
  } catch (err) {
    next(err);
  }
}

export async function doctorLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const { rows } = await query(`SELECT * FROM doctors WHERE email = $1`, [email]);
    const doctor = rows[0];
    if (!doctor || !doctor.password_hash || !(await bcrypt.compare(password, doctor.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    issueToken(res, { sub: doctor.id, role: 'doctor', name: doctor.name });
    res.json({ id: doctor.id, name: doctor.name, email: doctor.email, role: 'doctor' });
  } catch (err) {
    next(err);
  }
}

export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const { rows } = await query(`SELECT * FROM admins WHERE email = $1`, [email]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    issueToken(res, { sub: admin.id, role: 'admin', name: admin.name });
    res.json({ id: admin.id, name: admin.name, email: admin.email, role: 'admin' });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json(req.user);
}

export async function logout(_req, res) {
  res.clearCookie('cura_token');
  res.json({ ok: true });
}
