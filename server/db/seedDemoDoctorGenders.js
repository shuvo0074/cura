import { readFileSync } from 'node:fs';
import { pool } from '../db.js';
// These are fictional fixture records. Each fixture's gender matches its
// Bangladeshi given name (e.g. Fatema, Nusrat → female; Arif, Kamal → male)
// so the demo data reads naturally. Real (sourced) doctors and genders set
// by an admin (gender_is_demo = FALSE) are never touched.
const fixtures = JSON.parse(readFileSync(new URL('../data/demoDoctorGenderFixtures.json', import.meta.url), 'utf8'));
try {
  let updated = 0;
  for (const doctor of fixtures) {
    const { rowCount } = await pool.query(`UPDATE doctors SET gender=$1, gender_is_demo=TRUE
      WHERE name=$2 AND specialty=$3 AND source_url IS NULL
        AND (gender IS NULL OR gender_is_demo) AND gender IS DISTINCT FROM $1`,
    [doctor.gender, doctor.name, doctor.specialty]);
    updated += rowCount;
  }
  console.log(`Set name-based demo genders on ${updated} fictional fixture records; sourced and admin-set records preserved.`);
} finally { await pool.end(); }
