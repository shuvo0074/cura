// Brings hospitals seeded from an older src/data/hospitals.json up to date
// (seed.js skips databases that already have hospitals), matching rows by
// name and never overwriting edits:
//   - services, beds, test prices etc., where services are still empty;
//   - the photo, where it's still one of the original stock images;
//   - the real diagnostic centres (src/data/diagnosticCentres.json), added
//     once, replacing the old demo "Popular Diagnostic Centre".
//
//   npm run db:backfill-hospital-extras
//
// The API image only contains server/, so in Docker point HOSPITALS_JSON at
// the repo's data file mounted into the container:
//
//   docker compose run --rm -v "$PWD/src/data:/data" -e HOSPITALS_JSON=/data/hospitals.json \
//     api node db/backfill-hospital-extras.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import 'dotenv/config';
import { HOSPITAL_EXTRA_COLUMNS, hospitalExtras } from './hospitalExtras.js';
import { fillMissingCentrePhotos, insertMissingCentres, removeDemoPopular } from './diagnosticCentres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = process.env.HOSPITALS_JSON || join(__dirname, '..', '..', 'src', 'data', 'hospitals.json');
const hospitals = JSON.parse(readFileSync(file, 'utf-8'));
const centres = JSON.parse(readFileSync(join(dirname(file), 'diagnosticCentres.json'), 'utf-8'));
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
console.log(`Backfilled services etc. for ${updated} hospitals.`);

let photos = 0;
for (const h of hospitals) {
  if (!h.photo || /^https?:/.test(h.photo)) continue;
  const { rowCount } = await pool.query(
    `UPDATE hospitals SET photo = $1 WHERE name = $2 AND (photo IS NULL OR photo LIKE 'https://images.unsplash.com/%')`,
    [h.photo, h.name]
  );
  photos += rowCount;
}
console.log(`Replaced stock photos for ${photos} hospitals.`);

console.log(`Removed ${await removeDemoPopular(pool)} demo Popular Diagnostic Centre entry.`);
console.log(`Added ${await insertMissingCentres(pool, centres)} real diagnostic centres.`);
console.log(`Added photos to ${await fillMissingCentrePhotos(pool, centres)} diagnostic centres.`);
await pool.end();
