import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { seedContent } from './contentSeeds.js';

const SCHEMA = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');

// Applies schema.sql, which is idempotent (CREATE/ALTER ... IF NOT EXISTS),
// so it's safe on every start. Runs through the app's own pg pool: the API
// image has no psql, and a deploy only rebuilds the containers, so without
// this new columns never reach production.
export async function runMigrations(pool) {
  await pool.query(readFileSync(SCHEMA, 'utf8'));
  await seedContent(pool);
}

// `npm run db:migrate`: apply the schema without starting the API.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { pool } = await import('../db.js');
  try {
    await runMigrations(pool);
    console.log('Schema applied.');
  } finally {
    await pool.end();
  }
}
