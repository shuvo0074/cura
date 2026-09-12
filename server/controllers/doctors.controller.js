import { query } from '../db.js';

export async function listDoctors(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT d.*, h.name AS hospital_name FROM doctors d
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
      `SELECT d.*, h.name AS hospital_name FROM doctors d
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
    res.json(rows[0]);
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
