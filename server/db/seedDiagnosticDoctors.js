import { readFileSync } from 'node:fs';
import { pool } from '../db.js';
const doctors = JSON.parse(readFileSync(new URL('../data/diagnosticDoctors.json', import.meta.url), 'utf8'));
try {
  let added = 0;
  for (const doctor of doctors) {
    const { rowCount } = await pool.query(`INSERT INTO doctors
      (name, specialty, workplace, chamber, hospital_id, city, division, phone, address, website, source_url, verified_on)
      SELECT $1, $2, $3, h.name, h.id, h.location, h.division, h.hotline, h.address, $4, $4, $5
      FROM hospitals h WHERE h.name = $6 AND NOT EXISTS
        (SELECT 1 FROM doctors d WHERE lower(d.name) = lower($1) AND d.hospital_id = h.id)`,
    [doctor.name, doctor.specialty, doctor.workplace || null, doctor.source_url, '2026-10-09', doctor.centre]);
    added += rowCount;
  }
  console.log(`Added ${added} sourced diagnostic-centre doctors.`);
} finally { await pool.end(); }
