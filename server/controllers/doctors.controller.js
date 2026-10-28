import { query } from '../db.js';
import { logger } from '../logger.js';
import { bumpDailyStat } from './doctorInsights.controller.js';
import { bookingBlocker, dhakaNow, estimatedArrival, parseSessionTime } from '../schedule.js';

// The line of degrees shown after a doctor's name ("MBBS, FCPS (Medicine)"):
// the doctor's own entries in the order they earned them, else the
// listing's education text.
export const DEGREES = `(SELECT COALESCE(string_agg(i.title, ', ' ORDER BY i.end_year NULLS LAST, i.id), d.education)
     FROM doctor_profile_items i WHERE i.doctor_id = d.id AND i.kind = 'qualification') AS degrees`;

// Columns safe to expose publicly. Never select d.* in a public endpoint:
// the doctors table also holds login credentials (email, password_hash).
export const PUBLIC_DOCTOR_COLUMNS = `d.id, d.name, d.gender, d.gender_is_demo, d.specialty, d.department, d.experience, d.chamber, d.fees, d.followup_fees, d.workplace,
  d.city, d.division, d.hospital_id, d.phone, d.photo, d.rating, d.about, d.lat, d.lng, d.website,
  d.source_url, d.verified_on, d.share_count, d.bmdc_no, d.education, d.languages, d.consulting_hours, d.address,
  d.clinical_expertise, d.treatments, d.weekly_schedule, d.bmdc_verified_at,
  d.headline, d.slug, d.practicing_since, d.profile_updated_at, (d.user_id IS NOT NULL) AS is_managed, ${DEGREES}`;

// What a list row needs (cards and search results), not the full profile.
const LIST_DOCTOR_COLUMNS = `d.id, d.name, d.gender, d.gender_is_demo, d.specialty, d.department, d.experience, d.chamber, d.fees, d.followup_fees, d.workplace,
  d.city, d.division, d.photo, d.rating, d.bmdc_no, d.bmdc_verified_at, ${DEGREES}, (SELECT name FROM hospitals WHERE id = d.hospital_id) AS hospital_name`;
const MAX_PAGE_SIZE = 50;
const list = v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : []);

// With ?page (the mobile app): one filtered page of slim rows plus the total.
//   q            name or speciality contains (case-insensitive)
//   specialty, division, city   comma-separated exact values
// Without it (the web app): every doctor, full rows, as before.
export async function listDoctors(req, res, next) {
  if (req.query.page !== undefined) return searchDoctors(req, res, next);
  try {
    const { rows } = await query(
      `SELECT ${PUBLIC_DOCTOR_COLUMNS}, h.name AS hospital_name FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       WHERE NOT d.hidden
       ORDER BY d.id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function searchDoctors(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = ['NOT d.hidden'];
    const params = [];
    const q = String(req.query.q || '').trim();
    if (q) {
      params.push(`%${q}%`);
      where.push(`(d.name ILIKE $${params.length} OR d.specialty ILIKE $${params.length})`);
    }
    for (const col of ['specialty', 'division', 'city', 'gender']) {
      const values = list(req.query[col]);
      if (values.length) {
        params.push(values);
        where.push(`d.${col} = ANY($${params.length})`);
      }
    }
    const filter = `WHERE ${where.join(' AND ')}`;
    const [{ rows: [{ total }] }, { rows: items }] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total FROM doctors d ${filter}`, params),
      query(`SELECT ${LIST_DOCTOR_COLUMNS} FROM doctors d ${filter} ORDER BY d.name, d.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
}

async function findDoctor(where, value) {
  const { rows } = await query(
    `SELECT ${PUBLIC_DOCTOR_COLUMNS}, h.name AS hospital_name,
            (SELECT COUNT(*)::int FROM doctor_reviews r WHERE r.doctor_id = d.id AND r.hidden_at IS NULL) AS review_count,
            (SELECT ROUND(AVG(rating), 1)::float FROM doctor_reviews r WHERE r.doctor_id = d.id AND r.hidden_at IS NULL) AS review_average
     FROM doctors d
     LEFT JOIN hospitals h ON h.id = d.hospital_id
     WHERE ${where} = $1 AND NOT d.hidden`,
    [value]
  );
  return rows[0];
}

export async function getDoctor(req, res, next) {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Doctor not found' });
    const doctor = await findDoctor('d.id', req.params.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

// The /dr/<slug> public profile link.
export async function getDoctorBySlug(req, res, next) {
  try {
    const doctor = await findDoctor('d.slug', String(req.params.slug).toLowerCase());
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

export async function shareDoctor(req, res, next) {
  try {
    const { rows } = await query(
      `UPDATE doctors SET share_count = share_count + 1 WHERE id = $1 AND NOT hidden RETURNING id, share_count`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    await bumpDailyStat(rows[0].id, 'shares');
    logger.info({ event: 'doctor_shared', doctorId: rows[0].id, shareCount: rows[0].share_count }, 'Doctor profile shared');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// Logs "tapped to call this chamber" intent from the Call popover — the
// click, not confirmation a call was placed. There's no web API to observe
// what happens after window.open('tel:...') hands off to the OS dialer.
export async function logCall(req, res, next) {
  try {
    const { venue, phone } = req.body || {};
    const { rows } = await query(
      `INSERT INTO call_logs (doctor_id, venue, phone)
       SELECT id, $2, $3 FROM doctors WHERE id = $1 AND NOT hidden RETURNING id, created_at`,
      [req.params.id, venue || null, phone || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    logger.info(
      { event: 'call_tap', doctorId: req.params.id, venue, phone, callLogId: rows[0].id },
      'Call tapped'
    );
    res.json({ id: rows[0].id, created_at: rows[0].created_at });
  } catch (err) {
    next(err);
  }
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export async function getDoctorSlots(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param (YYYY-MM-DD) is required' });
    }
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();

    const { rows: availRows } = await query(
      `SELECT start_time, end_time, slot_minutes FROM doctor_availability
       WHERE doctor_id = $1 AND day_of_week = $2`,
      [id, dayOfWeek]
    );
    if (!availRows[0]) return res.json({ date, slots: [] });

    const { start_time, end_time, slot_minutes } = availRows[0];
    const startMin = timeToMinutes(start_time.slice(0, 5));
    const endMin = timeToMinutes(end_time.slice(0, 5));

    const { rows: bookedRows } = await query(
      `SELECT appointment_time FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'cancelled'`,
      [id, date]
    );
    const booked = new Set(bookedRows.map(r => r.appointment_time.slice(0, 5)));

    const slots = [];
    for (let m = startMin; m + slot_minutes <= endMin; m += slot_minutes) {
      const slot = minutesToTime(m);
      if (!booked.has(slot)) slots.push(slot);
    }
    res.json({ date, slots });
  } catch (err) {
    next(err);
  }
}

// A date's chamber sessions for one doctor, with serial-booking state:
// how many serials are taken, the next serial and its estimated arrival,
// whether it can still be booked, and the viewer's own serial if any.
export async function getDoctorSessions(req, res, next) {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param (YYYY-MM-DD) is required' });
    }
    const { rows: doctorRows } = await query(`SELECT weekly_schedule FROM doctors WHERE id = $1 AND NOT hidden`, [req.params.id]);
    if (!doctorRows[0]) return res.status(404).json({ error: 'Doctor not found' });

    const { rows: counts } = await query(
      `SELECT venue, session_time, MAX(serial_no) AS last_serial,
              COUNT(*) FILTER (WHERE status <> 'cancelled') AS booked
       FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND serial_no IS NOT NULL
       GROUP BY venue, session_time`,
      [req.params.id, date]
    );
    const patientId = req.user?.patientId ?? null;
    const { rows: mine } = patientId
      ? await query(
        `SELECT id, venue, session_time, serial_no FROM appointments
         WHERE doctor_id = $1 AND appointment_date = $2 AND patient_id = $3 AND status <> 'cancelled' AND serial_no IS NOT NULL`,
        [req.params.id, date, patientId]
      )
      : { rows: [] };

    const now = dhakaNow();
    const sessions = (doctorRows[0].weekly_schedule || []).map(entry => {
      const time = parseSessionTime(entry.time);
      const c = counts.find(r => r.venue === entry.venue && r.session_time === entry.time);
      const nextSerial = (c?.last_serial ?? 0) + 1;
      const own = mine.find(r => r.venue === entry.venue && r.session_time === entry.time);
      const blocker = time ? bookingBlocker(date, time, now) : { code: 'INVALID_SESSION', message: 'This session has no valid time.' };
      return {
        ...entry,
        booked: Number(c?.booked ?? 0),
        nextSerial,
        estimatedArrival: time ? estimatedArrival(time.start, nextSerial) : null,
        bookable: !blocker,
        reason: blocker?.message ?? null,
        reasonCode: blocker?.code ?? null,
        mine: own ? { id: own.id, serialNo: own.serial_no, estimatedArrival: estimatedArrival(time.start, own.serial_no) } : null,
      };
    });
    res.json({ date, sessions });
  } catch (err) {
    next(err);
  }
}

// A few doctors for the home page, without downloading the whole directory.
// No curation exists yet, so this is highest-rated first.
export async function featuredDoctors(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 24);
    const { rows } = await query(
      `SELECT ${PUBLIC_DOCTOR_COLUMNS}, h.name AS hospital_name FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       WHERE NOT d.hidden
       ORDER BY d.rating DESC NULLS LAST, d.share_count DESC, d.id
       LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Directory-wide numbers for the home page: totals plus doctor counts per
// specialty, per division and per district (city).
export async function directoryStats(_req, res, next) {
  try {
    const [{ rows: [totals] }, { rows: bySpecialty }, { rows: byDivision }, { rows: byCity }] = await Promise.all([
      query(`SELECT (SELECT COUNT(*) FROM doctors WHERE NOT hidden)::int AS doctors,
                    (SELECT COUNT(*) FROM hospitals WHERE NOT hidden)::int AS hospitals,
                    (SELECT COUNT(DISTINCT specialty) FROM doctors WHERE NOT hidden)::int AS specialties,
                    (SELECT COUNT(DISTINCT division) FROM doctors WHERE division IS NOT NULL AND NOT hidden)::int AS divisions,
                    (SELECT COUNT(*) FROM doctors WHERE bmdc_no IS NOT NULL AND NOT hidden)::int AS with_bmdc`),
      query(`SELECT specialty, COUNT(*)::int AS doctors FROM doctors WHERE NOT hidden GROUP BY specialty`),
      query(`SELECT division, COUNT(*)::int AS doctors FROM doctors WHERE division IS NOT NULL AND NOT hidden GROUP BY division`),
      query(`SELECT city, COUNT(*)::int AS doctors FROM doctors WHERE city IS NOT NULL AND NOT hidden GROUP BY city`),
    ]);
    res.json({
      ...totals,
      bySpecialty: Object.fromEntries(bySpecialty.map(r => [r.specialty, r.doctors])),
      byDivision: Object.fromEntries(byDivision.map(r => [r.division, r.doctors])),
      byCity: Object.fromEntries(byCity.map(r => [r.city, r.doctors])),
    });
  } catch (err) {
    next(err);
  }
}
