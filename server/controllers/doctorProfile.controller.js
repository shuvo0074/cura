import { query } from '../db.js';
import { logger } from '../logger.js';
import { saveDoctorPhoto, removeDoctorPhoto } from '../doctorPhotos.js';
import { ITEM_KINDS, slugify, cleanProfilePatch, cleanItem, completeness } from '../doctorProfile.js';

const MAX_ITEMS_PER_KIND = 40;
const ITEM_COLUMNS = 'id, kind, title, organization, location, start_year, end_year, is_current, url, description';
// Current roles first, then most recent.
const ITEM_ORDER = 'is_current DESC, COALESCE(end_year, start_year) DESC NULLS LAST, id DESC';

function groupItems(rows) {
  const groups = Object.fromEntries(ITEM_KINDS.map(k => [k, []]));
  for (const row of rows) groups[row.kind].push(row);
  return groups;
}

async function itemsFor(doctorId) {
  const { rows } = await query(
    `SELECT ${ITEM_COLUMNS} FROM doctor_profile_items WHERE doctor_id = $1 ORDER BY ${ITEM_ORDER}`, [doctorId]);
  return rows;
}

// Gives a doctor a profile link the first time they need one: their name,
// or name + number if taken, or their id as a last resort.
async function ensureSlug(doctor) {
  if (doctor.slug) return doctor.slug;
  const base = slugify(doctor.name);
  const candidates = base ? [base, ...[2, 3, 4, 5].map(n => `${base}-${n}`)] : [];
  candidates.push(`dr-${doctor.id}`);
  for (const slug of candidates) {
    const { rowCount } = await query(
      `UPDATE doctors SET slug = $2 WHERE id = $1 AND slug IS NULL
         AND NOT EXISTS (SELECT 1 FROM doctors WHERE slug = $2)`,
      [doctor.id, slug]
    );
    if (rowCount) return slug;
  }
  return null;
}

const SELF_COLUMNS = `id, name, specialty, bmdc_no, bmdc_verified_at, photo, headline, about, practicing_since,
  workplace, languages, website, fees, followup_fees, clinical_expertise, treatments, slug, profile_updated_at`;

async function selfProfile(doctorId) {
  const { rows } = await query(`SELECT ${SELF_COLUMNS} FROM doctors WHERE id = $1`, [doctorId]);
  const profile = rows[0];
  profile.slug = await ensureSlug(profile);
  const items = await itemsFor(doctorId);
  return { ...profile, items: groupItems(items), completeness: completeness(profile, items) };
}

// ── The signed-in doctor's own profile ──

export async function getMyProfile(req, res, next) {
  try {
    res.json(await selfProfile(req.user.doctorId));
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const { value, error } = cleanProfilePatch(req.body);
    if (error) return res.status(400).json({ error, code: 'VALIDATION' });
    const columns = Object.keys(value);
    if (columns.length) {
      const sets = columns.map((c, i) => `${c} = $${i + 2}`).join(', ');
      try {
        await query(`UPDATE doctors SET ${sets}, profile_updated_at = now() WHERE id = $1`, [req.user.doctorId, ...Object.values(value)]);
      } catch (err) {
        if (err.code === '23505' && err.constraint?.includes('slug')) {
          return res.status(409).json({ error: 'That profile link is taken. Try another.', code: 'SLUG_TAKEN' });
        }
        throw err;
      }
      logger.info({ event: 'doctor_profile_updated', doctorId: req.user.doctorId, fields: columns }, 'Doctor updated profile');
    }
    res.json(await selfProfile(req.user.doctorId));
  } catch (err) {
    next(err);
  }
}

export async function addMyItem(req, res, next) {
  try {
    const { value, error } = cleanItem(req.body);
    if (error) return res.status(400).json({ error, code: 'VALIDATION' });
    const { rows: count } = await query(
      `SELECT COUNT(*)::int AS n FROM doctor_profile_items WHERE doctor_id = $1 AND kind = $2`, [req.user.doctorId, value.kind]);
    if (count[0].n >= MAX_ITEMS_PER_KIND) return res.status(400).json({ error: 'You have reached the limit for this section', code: 'LIMIT' });
    const cols = Object.keys(value);
    const { rows } = await query(
      `INSERT INTO doctor_profile_items (doctor_id, ${cols.join(', ')})
       VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING ${ITEM_COLUMNS}`,
      [req.user.doctorId, ...Object.values(value)]
    );
    await query(`UPDATE doctors SET profile_updated_at = now() WHERE id = $1`, [req.user.doctorId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateMyItem(req, res, next) {
  try {
    const { value, error } = cleanItem(req.body);
    if (error) return res.status(400).json({ error, code: 'VALIDATION' });
    const cols = Object.keys(value).filter(c => c !== 'kind');
    const { rows } = await query(
      `UPDATE doctor_profile_items SET ${cols.map((c, i) => `${c} = $${i + 3}`).join(', ')}
       WHERE id = $1 AND doctor_id = $2 RETURNING ${ITEM_COLUMNS}`,
      [req.params.itemId, req.user.doctorId, ...cols.map(c => value[c])]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Entry not found', code: 'NOT_FOUND' });
    await query(`UPDATE doctors SET profile_updated_at = now() WHERE id = $1`, [req.user.doctorId]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deleteMyItem(req, res, next) {
  try {
    const { rowCount } = await query(
      `DELETE FROM doctor_profile_items WHERE id = $1 AND doctor_id = $2`, [req.params.itemId, req.user.doctorId]);
    if (!rowCount) return res.status(404).json({ error: 'Entry not found', code: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function setMyPhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Upload a JPEG, PNG or WebP image under 5 MB', code: 'VALIDATION' });
    const photo = await saveDoctorPhoto(req.user.doctorId, req.file);
    await query(`UPDATE doctors SET profile_updated_at = now() WHERE id = $1`, [req.user.doctorId]);
    res.json({ photo });
  } catch (err) {
    next(err);
  }
}

export async function deleteMyPhoto(req, res, next) {
  try {
    await removeDoctorPhoto(req.user.doctorId);
    res.json({ photo: null });
  } catch (err) {
    next(err);
  }
}

// ── Public profile extras: /doctors/:id/profile ──

// Career entries, endorsements and reviews. Separate from GET /doctors/:id
// so the booking view (and the mobile app) stays light.
export async function getPublicProfile(req, res, next) {
  try {
    const doctorId = Number(req.params.id);
    const { rows: doctors } = await query(`SELECT id, clinical_expertise FROM doctors WHERE id = $1`, [doctorId]);
    if (!doctors[0]) return res.status(404).json({ error: 'Doctor not found' });
    const expertise = doctors[0].clinical_expertise || [];
    const viewerDoctorId = req.user?.doctorId ?? null;

    const [items, endorsements, summary, recent, viewer] = await Promise.all([
      itemsFor(doctorId),
      // Endorsements only count for skills still on the profile.
      query(
        `SELECT e.skill, COUNT(*)::int AS count,
                BOOL_OR(e.endorser_doctor_id = $2) AS endorsed_by_me,
                (ARRAY_AGG(json_build_object('id', d.id, 'name', d.name, 'photo', d.photo, 'specialty', d.specialty)
                  ORDER BY e.created_at DESC))[1:3] AS endorsers
         FROM doctor_endorsements e JOIN doctors d ON d.id = e.endorser_doctor_id
         WHERE e.doctor_id = $1 AND e.skill = ANY($3::text[])
         GROUP BY e.skill`,
        [doctorId, viewerDoctorId, expertise]
      ),
      query(
        `SELECT COUNT(*)::int AS count, ROUND(AVG(rating), 1)::float AS average
         FROM doctor_reviews WHERE doctor_id = $1 AND hidden_at IS NULL`, [doctorId]),
      query(
        `SELECT id, rating, comment, created_at FROM doctor_reviews
         WHERE doctor_id = $1 AND hidden_at IS NULL ORDER BY created_at DESC LIMIT 6`, [doctorId]),
      viewerDoctorId
        ? query(`SELECT bmdc_verified_at IS NOT NULL AS verified FROM doctors WHERE id = $1`, [viewerDoctorId])
        : Promise.resolve({ rows: [] }),
    ]);

    const bySkill = new Map(endorsements.rows.map(r => [r.skill, r]));
    res.json({
      items: groupItems(items),
      // Every listed skill, endorsed or not, in the doctor's own order.
      endorsements: expertise.map(skill => ({
        skill,
        count: bySkill.get(skill)?.count || 0,
        endorsedByMe: Boolean(bySkill.get(skill)?.endorsed_by_me),
        endorsers: bySkill.get(skill)?.endorsers || [],
      })),
      reviews: { ...summary.rows[0], recent: recent.rows },
      // Verified doctors can vouch for colleagues, never for themselves.
      canEndorse: Boolean(viewer.rows[0]?.verified) && viewerDoctorId !== doctorId,
      isOwner: viewerDoctorId === doctorId,
    });
  } catch (err) {
    next(err);
  }
}

async function endorsementTarget(req, res) {
  const doctorId = Number(req.params.id);
  const skill = typeof req.body?.skill === 'string' ? req.body.skill : req.query.skill;
  if (doctorId === req.user.doctorId) {
    res.status(400).json({ error: 'You can’t endorse yourself', code: 'SELF_ENDORSE' });
    return null;
  }
  const { rows } = await query(
    `SELECT (SELECT bmdc_verified_at IS NOT NULL FROM doctors WHERE id = $3) AS endorser_verified,
            $2 = ANY(clinical_expertise) AS has_skill
     FROM doctors WHERE id = $1`,
    [doctorId, skill, req.user.doctorId]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Doctor not found', code: 'NOT_FOUND' });
    return null;
  }
  if (!rows[0].endorser_verified) {
    res.status(403).json({ error: 'Only BMDC-verified doctors can endorse colleagues', code: 'NOT_VERIFIED' });
    return null;
  }
  if (!rows[0].has_skill) {
    res.status(400).json({ error: 'That isn’t one of this doctor’s listed areas of expertise', code: 'VALIDATION' });
    return null;
  }
  return { doctorId, skill };
}

export async function endorse(req, res, next) {
  try {
    const target = await endorsementTarget(req, res);
    if (!target) return;
    await query(
      `INSERT INTO doctor_endorsements (doctor_id, endorser_doctor_id, skill) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [target.doctorId, req.user.doctorId, target.skill]
    );
    logger.info({ event: 'doctor_endorsed', doctorId: target.doctorId, endorserDoctorId: req.user.doctorId, skill: target.skill }, 'Doctor endorsed');
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function unendorse(req, res, next) {
  try {
    await query(
      `DELETE FROM doctor_endorsements WHERE doctor_id = $1 AND endorser_doctor_id = $2 AND skill = $3`,
      [req.params.id, req.user.doctorId, req.query.skill]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── Reviews ──

// A patient reviews a visit that the doctor marked completed; one review
// per appointment.
export async function reviewAppointment(req, res, next) {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars', code: 'VALIDATION' });
    }
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 1000) || null : null;
    const { rows: appts } = await query(
      `SELECT doctor_id, status FROM appointments WHERE id = $1 AND patient_id = $2`, [req.params.id, req.user.patientId]);
    if (!appts[0]) return res.status(404).json({ error: 'Appointment not found', code: 'NOT_FOUND' });
    if (appts[0].status !== 'completed') {
      return res.status(400).json({ error: 'You can review a visit once the doctor marks it completed', code: 'NOT_COMPLETED' });
    }
    const { rows } = await query(
      `INSERT INTO doctor_reviews (appointment_id, doctor_id, patient_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (appointment_id) DO NOTHING
       RETURNING id, rating, comment, created_at`,
      [req.params.id, appts[0].doctor_id, req.user.patientId, rating, comment]
    );
    if (!rows[0]) return res.status(409).json({ error: 'You have already reviewed this visit', code: 'ALREADY_REVIEWED' });
    logger.info({ event: 'review_created', appointmentId: Number(req.params.id), doctorId: appts[0].doctor_id, rating }, 'Patient reviewed a visit');
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}
