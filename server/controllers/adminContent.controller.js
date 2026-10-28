import { query } from '../db.js';
import { logger } from '../logger.js';
import { getSetting, setSetting } from '../settings.js';
import { ambulanceVendor, fareRanges, sampleTestPrices } from '../adminFields.js';

const VENDOR_COLUMNS = ['name', 'name_bn', 'base_area', 'address', 'address_bn', 'phones', 'categories', 'features',
  'dhaka_wide', 'service_areas', 'fares', 'source_url', 'source_checked_on'];
const JSON_COLUMNS = new Set(['phones', 'categories', 'features', 'service_areas', 'fares']);
const vendorValues = v => VENDOR_COLUMNS.map(c => (JSON_COLUMNS.has(c) ? JSON.stringify(v[c]) : v[c]));

// URL-safe id for the public list, from the name; numbered if taken.
async function freeSlug(name) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ambulance';
  const { rows } = await query(`SELECT slug FROM ambulance_vendors WHERE slug = $1 OR slug LIKE $1 || '-%'`, [base]);
  const taken = new Set(rows.map(r => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

function invalid(res, run) {
  try { return run(); } catch (err) { res.status(400).json({ error: err.message }); return null; }
}

export async function listAdminAmbulances(_req, res, next) {
  try {
    const { rows } = await query(`SELECT * FROM ambulance_vendors ORDER BY name`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function createAmbulance(req, res, next) {
  try {
    const v = invalid(res, () => ambulanceVendor(req.body));
    if (!v) return;
    const { rows } = await query(
      `INSERT INTO ambulance_vendors (slug, ${VENDOR_COLUMNS.join(', ')})
       VALUES ($1, ${VENDOR_COLUMNS.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`,
      [await freeSlug(v.name), ...vendorValues(v)]
    );
    logger.info({ event: 'admin_ambulance_created', adminId: req.user?.id, ambulanceId: rows[0].id, name: rows[0].name }, 'Admin created ambulance vendor');
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateAmbulance(req, res, next) {
  try {
    const v = invalid(res, () => ambulanceVendor(req.body));
    if (!v) return;
    const { rows } = await query(
      `UPDATE ambulance_vendors SET ${VENDOR_COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ')}
       WHERE id = $${VENDOR_COLUMNS.length + 1} RETURNING *`,
      [...vendorValues(v), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ambulance vendor not found' });
    logger.info({ event: 'admin_ambulance_updated', adminId: req.user?.id, ambulanceId: rows[0].id, name: rows[0].name }, 'Admin updated ambulance vendor');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function setAmbulanceHidden(req, res, next) {
  try {
    if (typeof req.body?.hidden !== 'boolean') return res.status(400).json({ error: 'hidden must be true or false' });
    const { rows } = await query(`UPDATE ambulance_vendors SET hidden = $1 WHERE id = $2 RETURNING id, name, hidden`, [req.body.hidden, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ambulance vendor not found' });
    logger.info({ event: `admin_ambulance_${rows[0].hidden ? 'hidden' : 'shown'}`, adminId: req.user?.id, ambulanceId: rows[0].id }, 'Admin changed ambulance visibility');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// Nothing else refers to a vendor, so delete is always allowed.
export async function deleteAmbulance(req, res, next) {
  try {
    const { rows } = await query(`DELETE FROM ambulance_vendors WHERE id = $1 RETURNING id, name`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ambulance vendor not found' });
    logger.info({ event: 'admin_ambulance_deleted', adminId: req.user?.id, ambulanceId: rows[0].id, name: rows[0].name }, 'Admin deleted ambulance vendor');
    res.json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
}

// The shared sample fares, the sample test price list and its on/off switch.
export async function getSamplePrices(_req, res, next) {
  try {
    const [ambulanceFares, testPrices, showTestPrices] = await Promise.all([
      getSetting('ambulance_sample_fares', {}), getSetting('sample_test_prices', []), getSetting('show_sample_test_prices', true),
    ]);
    res.json({ ambulanceFares, testPrices, showTestPrices });
  } catch (err) {
    next(err);
  }
}

export async function updateSamplePrices(req, res, next) {
  try {
    const body = req.body || {};
    const changes = invalid(res, () => ({
      ...('ambulanceFares' in body && { ambulance_sample_fares: fareRanges(body.ambulanceFares, undefined, { all: true }) }),
      ...('testPrices' in body && { sample_test_prices: sampleTestPrices(body.testPrices) }),
      ...('showTestPrices' in body && { show_sample_test_prices: body.showTestPrices === true }),
    }));
    if (!changes) return;
    for (const [key, value] of Object.entries(changes)) await setSetting(key, value);
    logger.info({ event: 'admin_sample_prices_updated', adminId: req.user?.id, keys: Object.keys(changes) }, 'Admin updated sample prices');
    await getSamplePrices(req, res, next);
  } catch (err) {
    next(err);
  }
}
