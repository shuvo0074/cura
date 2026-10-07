import pg from 'pg';
import { config } from './config.js';

// Return DATE columns as plain 'YYYY-MM-DD' strings. By default pg turns
// them into JS Dates at server-local midnight, which serialise to the
// previous day in UTC (Asia/Dhaka is UTC+6) — every appointment date showed
// one day early.
pg.types.setTypeParser(pg.types.builtins.DATE, value => value);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export function query(text, params) {
  return pool.query(text, params);
}
