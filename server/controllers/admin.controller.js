import { query } from '../db.js';

function toNum(value) {
  if (value === '' || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Admin form sends these as comma-separated strings; Postgres wants a real array.
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return null;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export async function listAllAppointments(req, res, next) {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE a.status = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT a.*, d.name AS doctor_name, p.phone AS patient_phone
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN patients p ON p.id = a.patient_id
       ${where}
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function createDoctor(req, res, next) {
  try {
    const d = req.body;
    const { rows } = await query(
      `INSERT INTO doctors (name, specialty, department, experience, chamber, fees, city, hospital_id, phone, photo, rating, about, lat, lng, website,
        bmdc_no, education, languages, consulting_hours, address, clinical_expertise, treatments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [d.name, d.specialty, d.department, d.experience, d.chamber, toNum(d.fees), d.city, d.hospitalId || null,
        d.phone, d.photo, toNum(d.rating), d.about, toNum(d.lat), toNum(d.lng), d.website,
        d.bmdcNo, d.education, d.languages, d.consultingHours, d.address, toArray(d.clinicalExpertise), toArray(d.treatments)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateDoctor(req, res, next) {
  try {
    const d = req.body;
    const { rows } = await query(
      `UPDATE doctors SET name=$1, specialty=$2, department=$3, experience=$4, chamber=$5, fees=$6,
        city=$7, hospital_id=$8, phone=$9, photo=$10, rating=$11, about=$12, lat=$13, lng=$14, website=$15,
        bmdc_no=$16, education=$17, languages=$18, consulting_hours=$19, address=$20, clinical_expertise=$21, treatments=$22
       WHERE id = $23 RETURNING *`,
      [d.name, d.specialty, d.department, d.experience, d.chamber, toNum(d.fees), d.city, d.hospitalId || null,
        d.phone, d.photo, toNum(d.rating), d.about, toNum(d.lat), toNum(d.lng), d.website,
        d.bmdcNo, d.education, d.languages, d.consultingHours, d.address, toArray(d.clinicalExpertise), toArray(d.treatments), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function createHospital(req, res, next) {
  try {
    const h = req.body;
    const { rows } = await query(
      `INSERT INTO hospitals (name, location, address, hotline, photo, lat, lng, website, doctor_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0) RETURNING *`,
      [h.name, h.location, h.address, h.hotline, h.photo, toNum(h.lat), toNum(h.lng), h.website]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateHospital(req, res, next) {
  try {
    const h = req.body;
    const { rows } = await query(
      `UPDATE hospitals SET name=$1, location=$2, address=$3, hotline=$4, photo=$5, lat=$6, lng=$7, website=$8
       WHERE id = $9 RETURNING *`,
      [h.name, h.location, h.address, h.hotline, h.photo, toNum(h.lat), toNum(h.lng), h.website, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Hospital not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}
