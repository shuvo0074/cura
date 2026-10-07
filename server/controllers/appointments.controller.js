import { pool, query } from '../db.js';
import { bookingBlocker, estimatedArrival, minutesToTime, parseSessionTime, withEstimatedArrival } from '../schedule.js';
import { logger } from '../logger.js';

// Books a serial in one chamber session. The session must exist in the
// doctor's weekly_schedule and still be bookable (not Friday, not past, not
// already ended today, within the booking window). Serials are assigned under
// a per-session advisory lock so concurrent bookings can't collide, and are
// never reused after a cancellation.
export async function createAppointment(req, res, next) {
  const { doctorId, date, venue, session, notes } = req.body;
  if (!doctorId || !date || !venue || !session) {
    return res.status(400).json({ error: 'doctorId, date, venue and session are required' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const client = await pool.connect();
  try {
    const { rows: doctorRows } = await client.query(`SELECT weekly_schedule FROM doctors WHERE id = $1`, [doctorId]);
    if (!doctorRows[0]) return res.status(404).json({ error: 'Doctor not found' });
    const entry = (doctorRows[0].weekly_schedule || []).find(e => e.venue === venue && e.time === session);
    const time = entry && parseSessionTime(entry.time);
    if (!time) return res.status(400).json({ error: 'This doctor has no such chamber session.' });
    const blocker = bookingBlocker(date, time);
    if (blocker) return res.status(400).json({ error: blocker });

    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`serial:${doctorId}:${date}:${venue}:${session}`]);

    const { rows: existing } = await client.query(
      `SELECT serial_no FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2 AND appointment_date = $3 AND venue = $4 AND session_time = $5
         AND status <> 'cancelled' AND serial_no IS NOT NULL`,
      [req.user.sub, doctorId, date, venue, session]
    );
    if (existing[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `You already have serial #${existing[0].serial_no} in this session.` });
    }

    const { rows: [{ next_serial }] } = await client.query(
      `SELECT COALESCE(MAX(serial_no), 0) + 1 AS next_serial FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND venue = $3 AND session_time = $4`,
      [doctorId, date, venue, session]
    );
    const { rows } = await client.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, venue, session_time, serial_no, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.sub, doctorId, date, minutesToTime(time.start), venue, session, next_serial, notes?.trim() || null]
    );
    await client.query('COMMIT');

    logger.info(
      { event: 'appointment_created', appointmentId: rows[0].id, patientId: req.user.sub, doctorId, date, venue, session, serialNo: next_serial },
      'Serial booked'
    );
    res.status(201).json({ ...rows[0], estimated_arrival: estimatedArrival(time.start, next_serial) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

export async function myAppointments(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT a.*, d.name AS doctor_name, d.specialty, d.photo AS doctor_photo, d.chamber,
              h.name AS hospital_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       WHERE a.patient_id = $1
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [req.user.sub]
    );
    res.json(rows.map(withEstimatedArrival));
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const { rows } = await query(
      `UPDATE appointments a SET status = 'cancelled'
       FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       WHERE a.id = $1 AND a.patient_id = $2 AND d.id = a.doctor_id
       RETURNING a.*, d.name AS doctor_name, d.specialty, d.photo AS doctor_photo, d.chamber, h.name AS hospital_name`,
      [req.params.id, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    logger.info(
      { event: 'appointment_cancelled', appointmentId: rows[0].id, patientId: req.user.sub, doctorId: rows[0].doctor_id },
      'Appointment cancelled'
    );
    res.json(withEstimatedArrival(rows[0]));
  } catch (err) {
    next(err);
  }
}
