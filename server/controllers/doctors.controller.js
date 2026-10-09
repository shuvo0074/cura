import { query } from '../db.js';
import { logger } from '../logger.js';
import { bookingBlocker, dhakaNow, estimatedArrival, parseSessionTime } from '../schedule.js';

// Columns safe to expose publicly. Never select d.* in a public endpoint:
// the doctors table also holds login credentials (email, password_hash).
const PUBLIC_DOCTOR_COLUMNS = `d.id, d.name, d.gender, d.specialty, d.department, d.experience, d.chamber, d.fees, d.followup_fees, d.workplace,
  d.city, d.division, d.hospital_id, d.phone, d.photo, d.rating, d.about, d.lat, d.lng, d.website,
  d.source_url, d.verified_on, d.share_count, d.bmdc_no, d.education, d.languages, d.consulting_hours, d.address,
  d.clinical_expertise, d.treatments, d.weekly_schedule`;

export async function listDoctors(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT ${PUBLIC_DOCTOR_COLUMNS}, h.name AS hospital_name FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       ORDER BY d.id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getDoctor(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT ${PUBLIC_DOCTOR_COLUMNS}, h.name AS hospital_name FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function shareDoctor(req, res, next) {
  try {
    const { rows } = await query(
      `UPDATE doctors SET share_count = share_count + 1 WHERE id = $1 RETURNING id, share_count`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
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
      `INSERT INTO call_logs (doctor_id, venue, phone) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [req.params.id, venue || null, phone || null]
    );
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
    const { rows: doctorRows } = await query(`SELECT weekly_schedule FROM doctors WHERE id = $1`, [req.params.id]);
    if (!doctorRows[0]) return res.status(404).json({ error: 'Doctor not found' });

    const { rows: counts } = await query(
      `SELECT venue, session_time, MAX(serial_no) AS last_serial,
              COUNT(*) FILTER (WHERE status <> 'cancelled') AS booked
       FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND serial_no IS NOT NULL
       GROUP BY venue, session_time`,
      [req.params.id, date]
    );
    const patientId = req.user?.role === 'patient' ? req.user.sub : null;
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
      const blocker = time ? bookingBlocker(date, time, now) : 'This session has no valid time.';
      return {
        ...entry,
        booked: Number(c?.booked ?? 0),
        nextSerial,
        estimatedArrival: time ? estimatedArrival(time.start, nextSerial) : null,
        bookable: !blocker,
        reason: blocker,
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
      query(`SELECT (SELECT COUNT(*) FROM doctors)::int AS doctors,
                    (SELECT COUNT(*) FROM hospitals)::int AS hospitals,
                    (SELECT COUNT(DISTINCT specialty) FROM doctors)::int AS specialties,
                    (SELECT COUNT(DISTINCT division) FROM doctors WHERE division IS NOT NULL)::int AS divisions,
                    (SELECT COUNT(*) FROM doctors WHERE bmdc_no IS NOT NULL)::int AS with_bmdc`),
      query(`SELECT specialty, COUNT(*)::int AS doctors FROM doctors GROUP BY specialty`),
      query(`SELECT division, COUNT(*)::int AS doctors FROM doctors WHERE division IS NOT NULL GROUP BY division`),
      query(`SELECT city, COUNT(*)::int AS doctors FROM doctors WHERE city IS NOT NULL GROUP BY city`),
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
