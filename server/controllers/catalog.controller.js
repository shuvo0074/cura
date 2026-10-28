import path from 'path';
import { pool, query } from '../db.js';
import { logger } from '../logger.js';
import { uploadBuffer, deleteObject, objectNameFromUrl } from '../storage.js';
import { catalogEntry, slugify } from '../adminFields.js';

// Specialties and symptoms: the same admin operations on two tables.
const KINDS = {
  specialties: { label: 'Specialty', columns: ['name', 'name_bn', 'icon', 'description', 'tags', 'image'], options: { icon: true } },
  symptoms: { label: 'Symptom', columns: ['name', 'name_bn', 'description', 'tags', 'image', 'specialties'], options: { specialties: true } },
};
const JSON_COLUMNS = new Set(['tags', 'specialties']);
const values = (kind, e) => KINDS[kind].columns.map(c => (JSON_COLUMNS.has(c) ? JSON.stringify(e[c]) : e[c]));

// Public lists for the specialty and symptom pages.
export const listPublic = kind => async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM ${kind} WHERE NOT hidden ORDER BY name`);
    res.json(rows.map(({ hidden: _hidden, ...row }) => row));
  } catch (err) {
    next(err);
  }
};

export const listAdmin = kind => async (_req, res, next) => {
  try {
    const counts = kind === 'specialties'
      ? `, (SELECT COUNT(*)::int FROM doctors d WHERE d.specialty = t.name) AS doctor_count` : '';
    const { rows } = await query(`SELECT t.*${counts} FROM ${kind} t ORDER BY t.name`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

async function freeSlug(client, kind, name) {
  const base = slugify(name) || kind.slice(0, -1);
  const { rows } = await client.query(`SELECT slug FROM ${kind} WHERE slug = $1 OR slug LIKE $1 || '-%'`, [base]);
  const taken = new Set(rows.map(r => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

// A specialty typed on a doctor ("Other…") that isn't on the list yet is
// added hidden, so it shows in the Specialties tab for an admin to fill in.
export async function ensureSpecialty(name) {
  const { rows } = await query(`SELECT 1 FROM specialties WHERE name = $1`, [name]);
  if (rows[0]) return;
  await query(`INSERT INTO specialties (slug, name, hidden) VALUES ($1, $2, TRUE) ON CONFLICT DO NOTHING`,
    [await freeSlug(pool, 'specialties', name), name]);
}

// A symptom may only point at specialties that exist.
async function checkSpecialties(client, entry) {
  if (!entry.specialties?.length) return null;
  const { rows } = await client.query(`SELECT name FROM specialties WHERE name = ANY($1)`, [entry.specialties]);
  const missing = entry.specialties.filter(n => !rows.some(r => r.name === n));
  return missing.length ? `Unknown specialty: ${missing.join(', ')}` : null;
}

const duplicateName = (err, label) => (err.code === '23505' ? `Another ${label.toLowerCase()} already has this name` : null);

export const create = kind => async (req, res, next) => {
  const { label, columns, options } = KINDS[kind];
  let entry;
  try { entry = catalogEntry(req.body || {}, options); } catch (err) { return res.status(400).json({ error: err.message }); }
  try {
    const problem = await checkSpecialties(pool, entry);
    if (problem) return res.status(400).json({ error: problem });
    const { rows } = await query(
      `INSERT INTO ${kind} (slug, ${columns.join(', ')}) VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`,
      [await freeSlug(pool, kind, entry.name), ...values(kind, entry)]);
    logger.info({ event: `admin_${kind}_created`, adminId: req.user?.id, id: rows[0].id, name: rows[0].name }, `Admin created ${label.toLowerCase()}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    const message = duplicateName(err, label);
    if (message) return res.status(409).json({ error: message });
    next(err);
  }
};

// Renaming a specialty renames it on its doctors and in symptoms' lists, in
// one transaction, so nobody drops out of their specialty page.
export const update = kind => async (req, res, next) => {
  const { label, columns, options } = KINDS[kind];
  let entry;
  try { entry = catalogEntry(req.body || {}, options); } catch (err) { return res.status(400).json({ error: err.message }); }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const problem = await checkSpecialties(client, entry);
    if (problem) { await client.query('ROLLBACK'); return res.status(400).json({ error: problem }); }
    const { rows: [before] } = await client.query(`SELECT name FROM ${kind} WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!before) { await client.query('ROLLBACK'); return res.status(404).json({ error: `${label} not found` }); }
    const { rows } = await client.query(
      `UPDATE ${kind} SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columns.length + 1} RETURNING *`,
      [...values(kind, entry), req.params.id]);
    let renamedDoctors = 0;
    if (kind === 'specialties' && before.name !== entry.name) {
      ({ rowCount: renamedDoctors } = await client.query(`UPDATE doctors SET specialty = $1 WHERE specialty = $2`, [entry.name, before.name]));
      await client.query(
        `UPDATE symptoms SET specialties = (
           SELECT jsonb_agg(CASE WHEN s = to_jsonb($2::text) THEN to_jsonb($1::text) ELSE s END) FROM jsonb_array_elements(specialties) s)
         WHERE specialties @> to_jsonb(ARRAY[$2::text])`, [entry.name, before.name]);
    }
    await client.query('COMMIT');
    logger.info({ event: `admin_${kind}_updated`, adminId: req.user?.id, id: rows[0].id, name: rows[0].name, renamedFrom: before.name !== entry.name ? before.name : undefined, renamedDoctors },
      `Admin updated ${label.toLowerCase()}`);
    res.json({ ...rows[0], renamedDoctors });
  } catch (err) {
    await client.query('ROLLBACK');
    const message = duplicateName(err, label);
    if (message) return res.status(409).json({ error: message });
    next(err);
  } finally {
    client.release();
  }
};

export const setHidden = kind => async (req, res, next) => {
  try {
    if (typeof req.body?.hidden !== 'boolean') return res.status(400).json({ error: 'hidden must be true or false' });
    const { rows } = await query(`UPDATE ${kind} SET hidden = $1 WHERE id = $2 RETURNING id, name, hidden`, [req.body.hidden, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: `${KINDS[kind].label} not found` });
    logger.info({ event: `admin_${kind}_${rows[0].hidden ? 'hidden' : 'shown'}`, adminId: req.user?.id, id: rows[0].id }, 'Admin changed visibility');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

async function removeUploadedImage(image) {
  const objName = objectNameFromUrl(image);
  if (objName?.startsWith('catalog-images/')) {
    try { await deleteObject(objName); } catch (err) { logger.warn({ err, objName }, 'Could not delete uploaded image'); }
  }
}

// Refused while doctors have the specialty or a symptom points at it.
export const remove = kind => async (req, res, next) => {
  try {
    const { rows: [row] } = await query(`SELECT id, name, image FROM ${kind} WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: `${KINDS[kind].label} not found` });
    if (kind === 'specialties') {
      const { rows: [use] } = await query(
        `SELECT (SELECT COUNT(*)::int FROM doctors WHERE specialty = $1) AS doctors,
                (SELECT COUNT(*)::int FROM symptoms WHERE specialties @> to_jsonb(ARRAY[$1::text])) AS symptoms`, [row.name]);
      if (use.doctors || use.symptoms) {
        const parts = [use.doctors && `${use.doctors} doctor(s) have this specialty`, use.symptoms && `${use.symptoms} symptom(s) point to it`].filter(Boolean);
        return res.status(409).json({ error: `${parts.join(' and ')}, so it can't be deleted. Move them first, or hide it instead.` });
      }
    }
    await query(`DELETE FROM ${kind} WHERE id = $1`, [row.id]);
    await removeUploadedImage(row.image);
    logger.info({ event: `admin_${kind}_deleted`, adminId: req.user?.id, id: row.id, name: row.name }, 'Admin deleted catalog entry');
    res.json({ id: row.id });
  } catch (err) {
    next(err);
  }
};

export const uploadImage = kind => async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const { rows: [row] } = await query(`SELECT id, image FROM ${kind} WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: `${KINDS[kind].label} not found` });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const image = await uploadBuffer(`catalog-images/${kind}-${row.id}-${Date.now()}${ext}`, req.file.buffer, req.file.mimetype);
    await query(`UPDATE ${kind} SET image = $1 WHERE id = $2`, [image, row.id]);
    if (row.image !== image) await removeUploadedImage(row.image);
    res.json({ photo: image });
  } catch (err) {
    next(err);
  }
};

// Same request/response shape as the doctor and hospital photo endpoints, so
// the admin photo field works for all of them.
export const deleteImage = kind => async (req, res, next) => {
  try {
    const { rows: [row] } = await query(`SELECT id, image FROM ${kind} WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: `${KINDS[kind].label} not found` });
    await query(`UPDATE ${kind} SET image = NULL WHERE id = $1`, [row.id]);
    await removeUploadedImage(row.image);
    res.json({ photo: null });
  } catch (err) {
    next(err);
  }
};
