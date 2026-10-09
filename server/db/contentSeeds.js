import { readFileSync } from 'node:fs';
import { PUBLISHED_CENTRES, SEED_SAMPLE_TEST_PRICES, withPublishedTestPrices } from '../publishedTestPrices.js';

const readJson = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));

// Content that used to live in JSON files and is now edited in the admin
// panel. Each import runs once, recorded in site_settings, so admin edits and
// deletions are never overwritten on a later start.
async function once(pool, key, run) {
  const { rowCount } = await pool.query(
    `INSERT INTO site_settings (key, value) VALUES ($1, 'true') ON CONFLICT (key) DO NOTHING`, [key]);
  if (rowCount) await run();
}

export async function seedContent(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialise concurrent starts so an import can't run twice.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('cura:content-seeds'))`);
    const fares = readJson('ambulanceSampleFares.json');
    await client.query(
      `INSERT INTO site_settings (key, value) VALUES
         ('ambulance_sample_fares', $1), ('sample_test_prices', $2), ('show_sample_test_prices', 'true')
       ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(fares.categories), JSON.stringify(SEED_SAMPLE_TEST_PRICES)]
    );

    await once(client, 'import:ambulance_vendors', async () => {
      for (const v of readJson('ambulanceVendors.json')) {
        await client.query(
          `INSERT INTO ambulance_vendors (slug, name, name_bn, base_area, address, address_bn, phones, categories, features,
             dhaka_wide, service_areas, source_url, source_checked_on)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (slug) DO NOTHING`,
          [v.id, v.name, v.name_bn, v.base_area, v.address, v.address_bn, JSON.stringify(v.phones), JSON.stringify(v.categories),
            JSON.stringify(v.features), v.dhaka_wide, JSON.stringify(v.service_areas), v.source_url, v.source_checked_on]
        );
      }
    });

    // Published diagnostic prices were merged in at read time; store them on
    // the centres so admins can see and edit them like any other price.
    await once(client, 'import:published_test_prices', async () => {
      const { rows } = await client.query(
        `SELECT id, name, type, tests FROM hospitals WHERE type = 'diagnostic' AND name = ANY($1)`, [PUBLISHED_CENTRES]);
      for (const centre of rows) {
        await client.query(`UPDATE hospitals SET tests = $1 WHERE id = $2`,
          [JSON.stringify(withPublishedTestPrices(centre).tests), centre.id]);
      }
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
