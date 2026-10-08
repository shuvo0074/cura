import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import 'dotenv/config';
import { hospitalExtras } from './hospitalExtras.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'src', 'data');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function readJson(name) {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf-8'));
}

async function main() {
  const hospitals = readJson('hospitals.json');
  const doctors = readJson('doctors.json');

  const { rows: existingHospitals } = await pool.query('SELECT COUNT(*) FROM hospitals');
  if (Number(existingHospitals[0].count) > 0) {
    console.log('Hospitals already seeded, skipping seed (schema.sql/seed.js are idempotent-safe to skip).');
    await pool.end();
    return;
  }

  const doctorPassword = process.env.SEED_DOCTOR_PASSWORD || 'DoctorPass123!';
  const doctorPasswordHash = await bcrypt.hash(doctorPassword, 10);

  const hospitalIdMap = {};
  for (const h of hospitals) {
    const { rows } = await pool.query(
      `INSERT INTO hospitals (name, location, division, address, hotline, photo, lat, lng, website, doctor_count, description,
        type, services, beds, tests, facilities, payment_methods, opening_hours, visiting_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [h.name, h.location, h.division, h.address, h.hotline, h.photo, h.lat, h.lng, h.website, h.doctorCount || 0, h.description || null,
        ...hospitalExtras(h)]
    );
    hospitalIdMap[h.id] = rows[0].id;
  }
  console.log(`Seeded ${hospitals.length} hospitals.`);

  const doctorIdMap = {};
  for (const d of doctors) {
    const matchedHospital = d.hospital
      ? hospitals.find(
          h => h.name === d.hospital || h.name.startsWith(d.hospital) || d.hospital.startsWith(h.name)
        )
      : null;
    const mappedHospitalId = matchedHospital ? hospitalIdMap[matchedHospital.id] : null;
    const email = `${d.name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^a-z]+/g, '.')}@cura.health`;
    const { rows } = await pool.query(
      `INSERT INTO doctors (name, specialty, department, experience, chamber, fees, city, hospital_id, phone, photo, rating, about, lat, lng, website, email, password_hash,
        bmdc_no, education, languages, consulting_hours, address, clinical_expertise, treatments, weekly_schedule, division)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING id`,
      [d.name, d.specialty, d.department, d.experience, d.chamber, d.fees, d.city, mappedHospitalId,
        d.phone, d.photo, d.rating, d.about, d.lat, d.lng, d.website, email, doctorPasswordHash,
        d.bmdcNo, d.education, d.languages, d.consultingHours, d.address, d.clinicalExpertise, d.treatments,
        d.weeklySchedule ? JSON.stringify(d.weeklySchedule) : null, d.division]
    );
    doctorIdMap[d.id] = rows[0].id;

    // Default weekly availability so booking has real slots immediately: Sat-Thu 09:00-17:00, 30-min slots.
    // day_of_week uses JS Date.getDay(): 0=Sun..6=Sat. Sat-Thu = 6,0,1,2,3,4.
    for (const dow of [6, 0, 1, 2, 3, 4]) {
      await pool.query(
        `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_minutes)
         VALUES ($1, $2, '09:00', '17:00', 30)`,
        [rows[0].id, dow]
      );
    }
  }
  console.log(`Seeded ${doctors.length} doctors with default availability. Doctor login password: ${doctorPassword} (email is firstname.lastname@cura.health, e.g. arif.khan@cura.health)`);

  const adminEmail = 'admin@cura.health';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await pool.query(
    `INSERT INTO admins (email, password_hash, name) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, adminHash, 'Cura Admin']
  );
  console.log(`Seeded admin user: ${adminEmail} / password: ${adminPassword}`);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
