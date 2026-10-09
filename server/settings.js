import { query } from './db.js';

// Site-wide values admins edit (see site_settings in schema.sql).
export async function getSetting(key, fallback = null) {
  const { rows } = await query(`SELECT value FROM site_settings WHERE key = $1`, [key]);
  return rows[0] ? rows[0].value : fallback;
}

export async function setSetting(key, value) {
  await query(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

// The sample test price list the API fills gaps with, or null when admins
// have switched sample prices off.
export async function activeSampleTestPrices() {
  const { rows } = await query(`SELECT key, value FROM site_settings WHERE key IN ('sample_test_prices', 'show_sample_test_prices')`);
  const values = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return values.show_sample_test_prices === false ? null : values.sample_test_prices ?? [];
}
