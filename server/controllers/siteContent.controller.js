import path from 'path';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { setSetting } from '../settings.js';
import { uploadBuffer } from '../storage.js';
import { siteTextPatch, homeContent, contactNumbers, photoCredits } from '../adminFields.js';

const KEYS = { site_text: 'text', home_content: 'home', contact_numbers: 'contacts', photo_credits: 'credits' };

// Everything the public site needs that admins edit outside the directory:
// text edits (applied over the built-in wording), home page picks, phone
// numbers and photo credits. One request, fetched once per page load.
async function siteContent() {
  const { rows } = await query(`SELECT key, value FROM site_settings WHERE key = ANY($1)`, [Object.keys(KEYS)]);
  return Object.fromEntries(rows.map(r => [KEYS[r.key], r.value]));
}

export async function getSiteContent(_req, res, next) {
  try {
    res.json(await siteContent());
  } catch (err) {
    next(err);
  }
}

function saver(key, validate, prepare = async value => value) {
  return async (req, res, next) => {
    let value;
    try { value = validate(req.body); } catch (err) { return res.status(400).json({ error: err.message }); }
    try {
      const problem = await prepare(value);
      if (typeof problem === 'string') return res.status(400).json({ error: problem });
      await setSetting(key, problem ?? value);
      logger.info({ event: 'admin_site_content_updated', adminId: req.user?.id, key }, 'Admin updated site content');
      res.json(await siteContent());
    } catch (err) {
      next(err);
    }
  };
}

// Text edits are merged into what's saved; null removes an edit.
export const updateSiteText = saver('site_text', siteTextPatch, async patch => {
  const { rows } = await query(`SELECT value FROM site_settings WHERE key = 'site_text'`);
  const current = rows[0]?.value ?? { en: {}, bn: {} };
  const next = { en: { ...current.en }, bn: { ...current.bn } };
  for (const [lang, entries] of Object.entries(patch)) {
    for (const [key, value] of Object.entries(entries)) {
      if (value === null) delete next[lang][key];
      else next[lang][key] = value;
    }
  }
  return next;
});

// Shortcuts must point at specialty and symptom pages that exist.
export const updateHomeContent = saver('home_content', homeContent, async home => {
  const [{ rows: specialties }, { rows: symptoms }] = await Promise.all([
    query(`SELECT slug FROM specialties`), query(`SELECT slug FROM symptoms`)]);
  const missing = [
    ...home.popular_specialties.filter(s => !specialties.some(r => r.slug === s.slug)).map(s => `specialty "${s.slug}"`),
    ...home.common_problems.filter(s => !symptoms.some(r => r.slug === s.slug)).map(s => `symptom "${s.slug}"`),
  ];
  return missing.length ? `No such ${missing.join(', ')}` : null;
});

export const updateContacts = saver('contact_numbers', contactNumbers);
export const updatePhotoCredits = saver('photo_credits', photoCredits);

// An image for site content (division photos, credited photos); returns its
// address for the form to use.
export async function uploadSiteImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const url = await uploadBuffer(`site-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`, req.file.buffer, req.file.mimetype);
    logger.info({ event: 'admin_site_image_uploaded', adminId: req.user?.id, url }, 'Admin uploaded site image');
    res.json({ url });
  } catch (err) {
    next(err);
  }
}
