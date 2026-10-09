import { readFileSync } from 'node:fs';
import { pool } from '../db.js';
// These are fictional fixture records. The alternating assignments are
// synthetic test data, never an inference from a person's name or photo.
const fixtures = JSON.parse(readFileSync(new URL('../data/demoDoctorGenderFixtures.json', import.meta.url), 'utf8'));
try {
  let updated = 0;
  for (const [index, doctor] of fixtures.entries()) {
    const { rowCount } = await pool.query(`UPDATE doctors SET gender=$1, gender_is_demo=TRUE
      WHERE name=$2 AND specialty=$3 AND source_url IS NULL AND gender IS NULL`,
    [index % 2 === 0 ? 'female' : 'male', doctor.name, doctor.specialty]);
    updated += rowCount;
  }
  console.log(`Assigned synthetic genders to ${updated} fictional fixture records; sourced and already assigned records preserved.`);
} finally { await pool.end(); }
