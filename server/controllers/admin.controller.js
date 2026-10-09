import path from 'path';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { uploadBuffer, deleteObject, objectNameFromUrl } from '../storage.js';
import { adminHospitalExtras } from '../db/hospitalExtras.js';
import { rating, latitude, longitude, sourceUrl, checkedOn } from '../adminFields.js';
import { PUBLIC_DOCTOR_COLUMNS } from './doctors.controller.js';

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

// Fields typed by hand that need checking, shared by doctors and hospitals.
// `required` maps body keys to their label. Throws a message for a 400.
function checkedFields(body, required) {
  for (const [key, label] of Object.entries(required)) {
    if (!body[key] || !String(body[key]).trim()) throw new Error(`${label} is required`);
  }
  return {
    rating: rating(body.rating), lat: latitude(body.lat), lng: longitude(body.lng),
    sourceUrl: sourceUrl(body.source_url), checkedOn: checkedOn(body.verified_on),
  };
}

const DOCTOR_REQUIRED = { name: 'Name', specialty: 'Specialty' };
const HOSPITAL_REQUIRED = { name: 'Name', location: 'City / location' };

export async function createDoctor(req, res, next) {
  try {
    const d = req.body;
    let c;
    try { c = checkedFields(d, DOCTOR_REQUIRED); } catch (err) { return res.status(400).json({ error: err.message }); }
    const { rows } = await query(
      `INSERT INTO doctors (name, specialty, department, experience, chamber, fees, city, hospital_id, phone, photo, rating, about, lat, lng, website,
        bmdc_no, education, languages, consulting_hours, address, clinical_expertise, treatments, division, workplace, followup_fees, weekly_schedule, gender,
        source_url, verified_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
      [d.name, d.specialty, d.department, d.experience, d.chamber, toNum(d.fees), d.city, d.hospitalId || null,
        d.phone, d.photo, c.rating, d.about, c.lat, c.lng, d.website,
        d.bmdcNo, d.education, d.languages, d.consultingHours, d.address, toArray(d.clinicalExpertise), toArray(d.treatments), d.division || null, d.workplace || null, toNum(d.followupFees) ?? 300, JSON.stringify(d.weeklySchedule ?? []), doctorGender(d.gender),
        c.sourceUrl, c.checkedOn]
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
    let c;
    try { c = checkedFields(d, DOCTOR_REQUIRED); } catch (err) { return res.status(400).json({ error: err.message }); }
    const { rows } = await query(
      `UPDATE doctors SET name=$1, specialty=$2, department=$3, experience=$4, chamber=$5, fees=$6,
        city=$7, hospital_id=$8, phone=$9, photo=$10, rating=$11, about=$12, lat=$13, lng=$14, website=$15,
        bmdc_no=$16, education=$17, languages=$18, consulting_hours=$19, address=$20, clinical_expertise=$21, treatments=$22, division=$23, workplace=$24, followup_fees=$25, weekly_schedule=COALESCE($26::jsonb, weekly_schedule), gender=$27, gender_is_demo=CASE WHEN gender IS DISTINCT FROM $27 THEN FALSE ELSE gender_is_demo END,
        source_url=$28, verified_on=$29
       WHERE id = $30 RETURNING *`,
      [d.name, d.specialty, d.department, d.experience, d.chamber, toNum(d.fees), d.city, d.hospitalId || null,
        d.phone, d.photo, c.rating, d.about, c.lat, c.lng, d.website,
        d.bmdcNo, d.education, d.languages, d.consultingHours, d.address, toArray(d.clinicalExpertise), toArray(d.treatments), d.division || null, d.workplace || null, toNum(d.followupFees), d.weeklySchedule === undefined ? null : JSON.stringify(d.weeklySchedule), doctorGender(d.gender),
        c.sourceUrl, c.checkedOn, req.params.id]
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
    let c;
    try { extras = adminHospitalExtras(h); c = checkedFields(h, HOSPITAL_REQUIRED); } catch (err) { return res.status(400).json({ error: err.message }); }
    const x = extrasSql(extras, 12);
    const { rows } = await query(
      `INSERT INTO hospitals (name, location, address, hotline, photo, lat, lng, website, doctor_count, division, description, source_url, verified_on${x.cols.map(col => `, ${col}`).join('')})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12${x.placeholders.map(p => `,${p}`).join('')}) RETURNING *`,
      [h.name, h.location, h.address, h.hotline, h.photo, c.lat, c.lng, h.website, h.division || null, h.description || null, c.sourceUrl, c.checkedOn, ...x.values]
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
    let c;
    try { extras = adminHospitalExtras(h); c = checkedFields(h, HOSPITAL_REQUIRED); } catch (err) { return res.status(400).json({ error: err.message }); }
    // Extras are only written when sent, so an older client can't wipe them.
    const x = extrasSql(extras, 13);
    const { rows } = await query(
      `UPDATE hospitals SET name=$1, location=$2, address=$3, hotline=$4, photo=$5, lat=$6, lng=$7, website=$8, division=$9, description=$10,
        source_url=$11, verified_on=$12${x.cols.map((col, i) => `, ${col}=${x.placeholders[i]}`).join('')}
       WHERE id = $13 RETURNING *`,
      [h.name, h.location, h.address, h.hotline, h.photo, c.lat, c.lng, h.website, h.division || null, h.description || null, c.sourceUrl, c.checkedOn, req.params.id, ...x.values]
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

// Admin lists include hidden records, which the public endpoints leave out.
export async function listAdminDoctors(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT ${PUBLIC_DOCTOR_COLUMNS}, d.hidden, h.name AS hospital_name FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       ORDER BY d.id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function listAdminHospitals(_req, res, next) {
  try {
    const { rows } = await query(`SELECT id, name, location, division, address, hotline, photo, type, hidden FROM hospitals ORDER BY id`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getAdminHospital(req, res, next) {
  try {
    const { rows } = await query(`SELECT * FROM hospitals WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Hospital not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// Hiding takes a record off the public site but keeps it, with its
// bookings and history, so it can be shown again.
function setHidden(table, label) {
  return async (req, res, next) => {
    try {
      if (typeof req.body?.hidden !== 'boolean') return res.status(400).json({ error: 'hidden must be true or false' });
      const { rows } = await query(`UPDATE ${table} SET hidden = $1 WHERE id = $2 RETURNING id, name, hidden`, [req.body.hidden, req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: `${label} not found` });
      logger.info({ event: `admin_${label.toLowerCase()}_${rows[0].hidden ? 'hidden' : 'shown'}`, adminId: req.user?.sub, id: rows[0].id, name: rows[0].name },
        `Admin ${rows[0].hidden ? 'hid' : 'showed'} ${label.toLowerCase()}`);
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  };
}
export const setDoctorHidden = setHidden('doctors', 'Doctor');
export const setHospitalHidden = setHidden('hospitals', 'Hospital');

async function removeUploadedPhoto(photo, marker) {
  const objName = objectNameFromUrl(photo);
  if (objName && objName.includes(marker)) {
    try { await deleteObject(objName); } catch (err) { logger.warn({ err, objName }, 'Could not delete uploaded photo'); }
  }
}

// Permanent delete, for duplicates and mistakes. Refused while anything
// still points at the record; hide it instead.
export async function deleteDoctor(req, res, next) {
  try {
    const { rows: [use] } = await query(`SELECT COUNT(*)::int AS bookings FROM appointments WHERE doctor_id = $1`, [req.params.id]);
    if (use.bookings) {
      return res.status(409).json({ error: `This doctor has ${use.bookings} booking(s), so they can't be deleted. Hide them instead.` });
    }
    const { rows } = await query(`DELETE FROM doctors WHERE id = $1 RETURNING id, name, photo`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    await removeUploadedPhoto(rows[0].photo, 'doctor-upload-');
    logger.info({ event: 'admin_doctor_deleted', adminId: req.user?.sub, doctorId: rows[0].id, name: rows[0].name }, 'Admin deleted doctor');
    res.json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
}

export async function deleteHospital(req, res, next) {
  try {
    const { rows: [hospital] } = await query(`SELECT id, name FROM hospitals WHERE id = $1`, [req.params.id]);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    // Same match as the hospital's doctor list: primary affiliation or a chamber there.
    const { rows: [use] } = await query(
      `SELECT COUNT(*)::int AS doctors FROM doctors d
       WHERE d.hospital_id = $2 OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(COALESCE(d.weekly_schedule, '[]'::jsonb)) elem
         WHERE elem->>'venue' = $1 OR elem->>'hospital_id' = $2::text)`,
      [hospital.name, hospital.id]
    );
    if (use.doctors) {
      return res.status(409).json({ error: `${use.doctors} doctor(s) list this place as their hospital or a chamber, so it can't be deleted. Hide it instead.` });
    }
    const { rows } = await query(`DELETE FROM hospitals WHERE id = $1 RETURNING id, name, photo`, [hospital.id]);
    await removeUploadedPhoto(rows[0].photo, 'hospital-upload-');
    logger.info({ event: 'admin_hospital_deleted', adminId: req.user?.sub, hospitalId: rows[0].id, name: rows[0].name }, 'Admin deleted hospital');
    res.json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
}
