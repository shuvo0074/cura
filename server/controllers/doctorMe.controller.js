import { query } from '../db.js';
import { logger } from '../logger.js';
import { withEstimatedArrival } from '../schedule.js';

export async function myAppointments(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT a.*, p.phone AS patient_phone, p.name AS patient_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.doctor_id = $1
       ORDER BY a.appointment_date DESC, a.appointment_time, a.venue, a.serial_no`,
      [req.user.sub]
    );
    // Within a day: by session, then serial — the order patients will be seen.
    res.json(rows.map(withEstimatedArrival));
  } catch (err) {
    next(err);
  }
}

export async function completeAppointment(req, res, next) {
  try {
    const { rows } = await query(
      `UPDATE appointments a SET status = 'completed'
       FROM patients p
       WHERE a.id = $1 AND a.doctor_id = $2 AND a.status = 'confirmed' AND p.id = a.patient_id
       RETURNING a.*, p.phone AS patient_phone, p.name AS patient_name`,
      [req.params.id, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found or not completable' });
    logger.info(
      { event: 'appointment_completed', appointmentId: rows[0].id, doctorId: req.user.sub },
      'Appointment marked completed'
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}
