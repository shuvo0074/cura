import path from 'path';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { uploadBuffer, deleteObject, objectNameFromUrl } from '../storage.js';
import { adminHospitalExtras } from '../db/hospitalExtras.js';

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

function doctorGender(value) { return ['male', 'female'].includes(value) ? value : null; }

export async function createDoctor(req, res, next) {
  try {
    const d = req.body;
    const { rows } = await query(
      `INSERT INTO doctors (name, specialty, department, experience, chamber, fees, city, hospital_id, phone, photo, rating, about, lat, lng, website,
        bmdc_no, education, languages, consulting_hours, address, clinical_expertise, treatments, division, workplace, followup_fees, weekly_schedule, gender)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING *`,
      [d.name, d.specialty, d.department, d.experience, d.chamber, toNum(d.fees), d.city, d.hospitalId || null,
        d.phone, d.photo, toNum(d.rating), d.about, toNum(d.lat), toNum(d.lng), d.website,
        d.bmdcNo, d.education, d.languages, d.consultingHours, d.address, toArray(d.clinicalExpertise), toArray(d.treatments), d.division || null, d.workplace || null, toNum(d.followupFees) ?? 300, JSON.stringify(d.weeklySchedule ?? []), doctorGender(d.gender)]
    );
    logger.info(
      { event: 'admin_doctor_created', adminId: req.user?.sub, doctorId: rows[0].id, name: rows[0].name },
      'Admin created doctor'
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
        bmdc_no=$16, education=$17, languages=$18, consulting_hours=$19, address=$20, clinical_expertise=$21, treatments=$22, division=$23, workplace=$24, followup_fees=$25, weekly_schedule=COALESCE($26::jsonb, weekly_schedule), gender=$27
       WHERE id = $28 RETURNING *`,
      [d.name, d.specialty, d.department, d.experience, d.chamber, toNum(d.fees), d.city, d.hospitalId || null,
        d.phone, d.photo, toNum(d.rating), d.about, toNum(d.lat), toNum(d.lng), d.website,
        d.bmdcNo, d.education, d.languages, d.consultingHours, d.address, toArray(d.clinicalExpertise), toArray(d.treatments), d.division || null, d.workplace || null, toNum(d.followupFees), d.weeklySchedule === undefined ? null : JSON.stringify(d.weeklySchedule), doctorGender(d.gender), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    logger.info(
      { event: 'admin_doctor_updated', adminId: req.user?.sub, doctorId: rows[0].id, name: rows[0].name },
      'Admin updated doctor'
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function setDoctorPhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const objectName = `doctor-photos/doctor-upload-${req.params.id}${ext}`;
    const photoPath = await uploadBuffer(objectName, req.file.buffer, req.file.mimetype);
    await query('UPDATE doctors SET photo = $1 WHERE id = $2', [photoPath, req.params.id]);
    res.json({ photo: photoPath });
  } catch (err) {
    next(err);
  }
}

export async function deleteDoctorPhoto(req, res, next) {
  try {
    const { rows } = await query('SELECT photo FROM doctors WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    const objName = objectNameFromUrl(rows[0].photo);
    await query('UPDATE doctors SET photo = NULL WHERE id = $1', [req.params.id]);
    if (objName && objName.includes('doctor-upload-')) await deleteObject(objName);
    res.json({ photo: null });
  } catch (err) {
    next(err);
  }
}

// "SET col = $n, …" for the hospital extras present in an admin request,
// numbered after `offset` existing parameters.
function extrasSql(extras, offset) {
  const cols = Object.keys(extras);
  return { cols, values: Object.values(extras), placeholders: cols.map((_, i) => `$${offset + i + 1}`) };
}

export async function createHospital(req, res, next) {
  try {
    const h = req.body;
    let extras;
    try { extras = adminHospitalExtras(h); } catch (err) { return res.status(400).json({ error: err.message }); }
    const x = extrasSql(extras, 10);
    const { rows } = await query(
      `INSERT INTO hospitals (name, location, address, hotline, photo, lat, lng, website, doctor_count, division, description${x.cols.map(c => `, ${c}`).join('')})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10${x.placeholders.map(p => `,${p}`).join('')}) RETURNING *`,
      [h.name, h.location, h.address, h.hotline, h.photo, toNum(h.lat), toNum(h.lng), h.website, h.division || null, h.description || null, ...x.values]
    );
    logger.info(
      { event: 'admin_hospital_created', adminId: req.user?.sub, hospitalId: rows[0].id, name: rows[0].name },
      'Admin created hospital'
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateHospital(req, res, next) {
  try {
    const h = req.body;
    let extras;
    try { extras = adminHospitalExtras(h); } catch (err) { return res.status(400).json({ error: err.message }); }
    // Extras are only written when sent, so an older client can't wipe them.
    const x = extrasSql(extras, 11);
    const { rows } = await query(
      `UPDATE hospitals SET name=$1, location=$2, address=$3, hotline=$4, photo=$5, lat=$6, lng=$7, website=$8, division=$9, description=$10${x.cols.map((c, i) => `, ${c}=${x.placeholders[i]}`).join('')}
       WHERE id = $11 RETURNING *`,
      [h.name, h.location, h.address, h.hotline, h.photo, toNum(h.lat), toNum(h.lng), h.website, h.division || null, h.description || null, req.params.id, ...x.values]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Hospital not found' });
    logger.info(
      { event: 'admin_hospital_updated', adminId: req.user?.sub, hospitalId: rows[0].id, name: rows[0].name },
      'Admin updated hospital'
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function setHospitalPhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const objectName = `hospital-photos/hospital-upload-${req.params.id}${ext}`;
    const photoPath = await uploadBuffer(objectName, req.file.buffer, req.file.mimetype);
    await query('UPDATE hospitals SET photo = $1 WHERE id = $2', [photoPath, req.params.id]);
    res.json({ photo: photoPath });
  } catch (err) {
    next(err);
  }
}

export async function deleteHospitalPhoto(req, res, next) {
  try {
    const { rows } = await query('SELECT photo FROM hospitals WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Hospital not found' });
    const objName = objectNameFromUrl(rows[0].photo);
    await query('UPDATE hospitals SET photo = NULL WHERE id = $1', [req.params.id]);
    if (objName && objName.includes('hospital-upload-')) await deleteObject(objName);
    res.json({ photo: null });
  } catch (err) {
    next(err);
  }
}
