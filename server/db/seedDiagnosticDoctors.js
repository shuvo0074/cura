import { readFileSync } from 'node:fs';
import { pool } from '../db.js';
const doctors = JSON.parse(readFileSync(new URL('../data/diagnosticDoctors.json', import.meta.url), 'utf8'));
try {
  let added = 0;
  let gendersFilled = 0;
  for (const doctor of doctors) {
    const { rowCount } = await pool.query(`INSERT INTO doctors
      (name, specialty, workplace, chamber, hospital_id, city, division, phone, address, website, source_url, verified_on, gender)
      SELECT $1, $2, $3, h.name, h.id, h.location, h.division, h.hotline, h.address, $4, $4, $5, $7
      FROM hospitals h WHERE h.name = $6 AND NOT EXISTS
        (SELECT 1 FROM doctors d WHERE lower(d.name) = lower($1) AND d.hospital_id = h.id)`,
    [doctor.name, doctor.specialty, doctor.workplace || null, doctor.source_url, '2026-10-09', doctor.centre, doctor.gender || null]);
    added += rowCount;
    if (doctor.gender) {
      const result = await pool.query(`UPDATE doctors d SET gender=$1
        FROM hospitals h WHERE d.hospital_id=h.id AND h.name=$2
        AND lower(d.name)=lower($3) AND d.source_url=$4 AND d.gender IS NULL`,
      [doctor.gender, doctor.centre, doctor.name, doctor.source_url]);
      gendersFilled += result.rowCount;
    }
  }
  console.log(`Added ${added} sourced diagnostic-centre doctors; filled ${gendersFilled} missing verified genders.`);
} finally { await pool.end(); }
