// Fills services, beds, test prices etc. into hospitals that were seeded
// before those columns existed (seed.js skips databases that already have
// hospitals). Matches rows to src/data/hospitals.json by name and only
// touches rows whose services are still empty, so it never overwrites edits.
//
//   npm run db:backfill-hospital-extras

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import 'dotenv/config';
import { HOSPITAL_EXTRA_COLUMNS, hospitalExtras } from './hospitalExtras.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const hospitals = JSON.parse(readFileSync(join(__dirname, '..', '..', 'src', 'data', 'hospitals.json'), 'utf-8'));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sets = HOSPITAL_EXTRA_COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ');
let updated = 0;
for (const h of hospitals) {
  const { rowCount } = await pool.query(
    `UPDATE hospitals SET ${sets} WHERE name = $${HOSPITAL_EXTRA_COLUMNS.length + 1} AND services IS NULL`,
    [...hospitalExtras(h), h.name]
  );
  updated += rowCount;
}
console.log(`Backfilled ${updated} hospitals.`);
await pool.end();
