import { query } from '../db.js';
import { withPublishedTestPrices } from '../publishedTestPrices.js';

export async function listHospitals(_req, res, next) {
  try {
    // Diagnostic prices also support search and price previews on centre cards.
    const { rows } = await query(
      `SELECT id, name, location, division, address, hotline, photo, lat, lng, website, doctor_count, description,
        type, services, beds, facilities, payment_methods, opening_hours, visiting_hours, source_url, verified_on,
        CASE WHEN type = 'diagnostic' THEN tests END AS tests
       FROM hospitals ORDER BY id`
    );
    res.json(rows.map(withPublishedTestPrices));
  } catch (err) {
    next(err);
  }
}

export async function getHospital(req, res, next) {
  try {
    const { rows } = await query(`SELECT * FROM hospitals WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Hospital not found' });
    res.json(withPublishedTestPrices(rows[0]));
  } catch (err) {
    next(err);
  }
}

// A doctor's `hospital_id` is only their primary affiliation — their
// weekly_schedule can list other venues too (e.g. a doctor whose hospital_id
// is Popular Diagnostic Centre may also hold hours at Al-Haramain Hospital).
// This matches on venue name so a hospital's page shows everyone who
// actually does duty there, not just doctors with a matching hospital_id.
export async function getHospitalDoctors(req, res, next) {
  try {
    const { rows: hospitalRows } = await query(`SELECT id, name FROM hospitals WHERE id = $1`, [req.params.id]);
    const hospital = hospitalRows[0];
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    const { rows } = await query(
      `SELECT d.id, d.name, d.specialty, d.department, d.experience, d.photo, d.rating, d.fees,
        (SELECT jsonb_agg(elem) FROM jsonb_array_elements(d.weekly_schedule) elem WHERE elem->>'venue' = $1) AS venue_schedule
       FROM doctors d
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(d.weekly_schedule) elem WHERE elem->>'venue' = $1
       )
       ORDER BY d.name`,
      [hospital.name]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
