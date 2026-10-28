import { pool, query } from '../db.js';
import { logger } from '../logger.js';

const STATUSES = ['pending', 'approved', 'rejected'];

export async function listVerifications(req, res, next) {
  try {
    const status = STATUSES.includes(req.query.status) ? req.query.status : 'pending';
    const { rows } = await query(
      `SELECT v.id, v.kind, v.status, v.bmdc_no, v.details, v.review_note, v.submitted_at, v.reviewed_at,
              u.id AS user_id, u.email, u.phone, u.name AS account_name,
              d.id AS doctor_id, d.name AS listing_name, d.specialty AS listing_specialty, d.photo AS listing_photo,
              d.bmdc_no AS listing_bmdc_no, d.user_id AS listing_user_id,
              (SELECT name FROM hospitals WHERE id = d.hospital_id) AS listing_hospital,
              rv.name AS reviewed_by_name
       FROM doctor_verifications v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN doctors d ON d.id = v.doctor_id
       LEFT JOIN users rv ON rv.id = v.reviewed_by
       WHERE v.status = $1
       ORDER BY ${status === 'pending' ? 'v.submitted_at' : 'v.reviewed_at DESC'}
       LIMIT 200`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

function withDrPrefix(name) {
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

// Approving links the account to its listing (creating the listing for a
// new doctor) and stamps the BMDC check that shows as the verified badge.
export async function approveVerification(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM doctor_verifications WHERE id = $1 AND status = 'pending' FOR UPDATE`, [req.params.id]);
    const v = rows[0];
    if (!v) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No pending request with that id', code: 'NOT_FOUND' });
    }
    const { rows: linked } = await client.query(`SELECT id FROM doctors WHERE user_id = $1`, [v.user_id]);
    if (linked[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This account already manages a doctor profile', code: 'ALREADY_LINKED' });
    }

    let doctorId = v.doctor_id;
    if (v.kind === 'claim') {
      const { rows: listing } = await client.query(`SELECT user_id FROM doctors WHERE id = $1 FOR UPDATE`, [doctorId]);
      if (listing[0]?.user_id) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Another account already manages this profile', code: 'BMDC_CLAIMED' });
      }
      await client.query(
        `UPDATE doctors SET user_id = $2, bmdc_no = $3, bmdc_verified_at = now() WHERE id = $1`,
        [doctorId, v.user_id, v.bmdc_no]
      );
    } else {
      const d = v.details;
      const { rows: inserted } = await client.query(
        `INSERT INTO doctors (name, specialty, gender, workplace, phone, bmdc_no, user_id, bmdc_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id`,
        [withDrPrefix(d.name), d.specialty, d.gender || null,
          [d.designation, d.workplace].filter(Boolean).join(', ') || null, d.phone || null, v.bmdc_no, v.user_id]
      );
      doctorId = inserted[0].id;
    }

    // Degrees entered at sign-up become the profile's qualifications, unless
    // a claimed listing already has its own.
    const degrees = Array.isArray(v.details.degrees) ? v.details.degrees : [];
    if (degrees.length) {
      const { rows: existing } = await client.query(
        `SELECT 1 FROM doctor_profile_items WHERE doctor_id = $1 AND kind = 'qualification' LIMIT 1`, [doctorId]);
      if (!existing[0]) {
        await client.query(
          `INSERT INTO doctor_profile_items (doctor_id, kind, title)
           SELECT $1, 'qualification', title FROM unnest($2::text[]) WITH ORDINALITY AS t(title, n) ORDER BY n`,
          [doctorId, degrees]
        );
      }
    }

    await client.query(
      `UPDATE doctor_verifications SET status = 'approved', doctor_id = $2, reviewed_at = now(), reviewed_by = $3 WHERE id = $1`,
      [v.id, doctorId, req.user.id]
    );
    // Other people's pending claims on the same profile can't succeed now.
    await client.query(
      `UPDATE doctor_verifications SET status = 'rejected', reviewed_at = now(), reviewed_by = $2,
         review_note = 'Another account was verified as the owner of this profile. If this is your profile, contact support.'
       WHERE doctor_id = $1 AND status = 'pending'`,
      [doctorId, req.user.id]
    );
    await client.query('COMMIT');
    logger.info({ event: 'doctor_verified', verificationId: v.id, doctorId, userId: v.user_id, adminId: req.user.id }, 'Doctor verification approved');
    res.json({ ok: true, doctorId });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function rejectVerification(req, res, next) {
  try {
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (note.length < 5) return res.status(400).json({ error: 'Tell the doctor why, so they can fix it', code: 'VALIDATION' });
    const { rows } = await query(
      `UPDATE doctor_verifications SET status = 'rejected', review_note = $2, reviewed_at = now(), reviewed_by = $3
       WHERE id = $1 AND status = 'pending' RETURNING id, user_id`,
      [req.params.id, note.slice(0, 500), req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No pending request with that id', code: 'NOT_FOUND' });
    logger.info({ event: 'doctor_verification_rejected', verificationId: rows[0].id, userId: rows[0].user_id, adminId: req.user.id }, 'Doctor verification rejected');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
