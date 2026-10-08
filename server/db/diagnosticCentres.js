// Real diagnostic centres (src/data/diagnosticCentres.json): details taken
// from each centre's own website, with the page and date recorded. The API
// fills missing prices from server/data/publishedTestPrices.json; existing
// admin-entered prices are kept.

// Common tests listed for every centre; unpublished prices stay null.
export const COMMON_TESTS = [
  ['Complete Blood Count (CBC)', 'blood'], ['Random Blood Sugar (RBS)', 'blood'], ['HbA1c', 'blood'],
  ['Lipid Profile', 'blood'], ['Thyroid (TSH)', 'blood'], ['Serum Creatinine', 'blood'],
  ['Urine Routine Examination', 'blood'], ['Dengue NS1 Antigen', 'blood'],
  ['X-ray Chest (PA view)', 'imaging'], ['Ultrasound Whole Abdomen', 'imaging'],
  ['CT Scan Brain', 'imaging'], ['MRI Brain', 'imaging'],
  ['ECG', 'cardiac'], ['Echocardiogram', 'cardiac'],
].map(([name, category]) => ({ name, category, price: null }));

export const VERIFIED_ON = '2026-10-09';

const COLUMNS = ['name', 'location', 'division', 'address', 'hotline', 'website', 'description', 'type',
  'services', 'tests', 'opening_hours', 'source_url', 'verified_on', 'doctor_count', 'photo'];

function row(c) {
  return [c.name, c.location, c.division, c.address, c.hotline, c.website, c.description, 'diagnostic',
    JSON.stringify(c.homeSample ? [{ key: 'home_sample', hours: null }] : []), JSON.stringify(COMMON_TESTS),
    c.openingHours || null, c.sourceUrl, VERIFIED_ON, 0, c.photo || null];
}

// Adds any centre not yet in the database (matched by name); never edits
// existing rows, so admin changes and entered prices are kept.
export async function insertMissingCentres(pool, centres) {
  let added = 0;
  for (const c of centres) {
    const { rowCount } = await pool.query(
      `INSERT INTO hospitals (${COLUMNS.join(', ')})
       SELECT ${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}
       WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE name = $1)`,
      row(c)
    );
    added += rowCount;
  }
  return added;
}

// The old demo entry "Popular Diagnostic Centre" (placed in Rangpur with a
// made-up hotline) is replaced by the real Dhanmondi centre.
export async function removeDemoPopular(pool) {
  const { rows } = await pool.query(
    `SELECT id FROM hospitals WHERE name = 'Popular Diagnostic Centre' AND location = 'Rangpur' AND source_url IS NULL`
  );
  for (const { id } of rows) {
    await pool.query('UPDATE doctors SET hospital_id = NULL WHERE hospital_id = $1', [id]);
    await pool.query('DELETE FROM hospitals WHERE id = $1', [id]);
  }
  return rows.length;
}

// Gives centres added earlier the photo they now have in the data file, only
// where they have none, so a photo uploaded through admin is kept.
export async function fillMissingCentrePhotos(pool, centres) {
  let filled = 0;
  for (const c of centres.filter(x => x.photo)) {
    const { rowCount } = await pool.query(
      'UPDATE hospitals SET photo = $1 WHERE name = $2 AND photo IS NULL', [c.photo, c.name]);
    filled += rowCount;
  }
  return filled;
}
