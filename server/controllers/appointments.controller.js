import { query } from '../db.js';
import { logger } from '../logger.js';

export async function createAppointment(req, res, next) {
  try {
    const { doctorId, date, time, notes } = req.body;
    if (!doctorId || !date || !time) {
      return res.status(400).json({ error: 'doctorId, date and time are required' });
    }
    const { rows } = await query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.sub, doctorId, date, time, notes || null]
    );
    logger.info(
      { event: 'appointment_created', appointmentId: rows[0].id, patientId: req.user.sub, doctorId, date, time },
      'Appointment booked'
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
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
    res.json(rows);
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
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}
