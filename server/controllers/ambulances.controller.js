import { query } from '../db.js';
import { getSetting } from '../settings.js';
import { withFares } from '../ambulanceFares.js';

export async function listAmbulances(_req, res, next) {
  try {
    const [{ rows }, sampleFares] = await Promise.all([
      query(`SELECT * FROM ambulance_vendors WHERE NOT hidden ORDER BY name`),
      getSetting('ambulance_sample_fares', {}),
    ]);
    res.json(rows.map(v => withFares(v, sampleFares)));
  } catch (err) {
    next(err);
  }
}
