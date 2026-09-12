import { query } from '../db.js';

export async function listHospitals(_req, res, next) {
  try {
    const { rows } = await query(`SELECT * FROM hospitals ORDER BY id`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getHospital(req, res, next) {
  try {
    const { rows } = await query(`SELECT * FROM hospitals WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Hospital not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}
