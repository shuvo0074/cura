// Hospital services, beds, test prices, facilities, payment methods and hours
// (see schema.sql), as SQL parameters in this column order.
export const HOSPITAL_EXTRA_COLUMNS = ['type', 'services', 'beds', 'tests', 'facilities', 'payment_methods', 'opening_hours', 'visiting_hours'];

export function hospitalExtras(h) {
  const json = v => (v == null ? null : JSON.stringify(v));
  return [h.type || null, json(h.services), json(h.beds), json(h.tests), json(h.facilities), json(h.paymentMethods),
    h.openingHours || null, h.visitingHours || null];
}

import { sourceUrl, checkedOn } from '../adminFields.js';

const TYPES = ['hospital', 'diagnostic', 'clinic', 'online'];
const TEST_CATEGORIES = ['blood', 'imaging', 'cardiac'];
const KEY = /^[a-z][a-z0-9_]{0,40}$/;
const text = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const count = v => (v === '' || v == null ? null : Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);

// Validates and tidies the extras an admin sends. Only fields present in the
// body are returned, so a partial update never wipes the others; a list sent
// as null (a record that never had one) is left as it is. Throws a message
// suitable for a 400 on bad input.
export function adminHospitalExtras(body) {
  const out = {};
  if ('type' in body) {
    if (body.type && !TYPES.includes(body.type)) throw new Error(`type must be one of ${TYPES.join(', ')}`);
    out.type = body.type || null;
  }
  if (body.services != null) {
    if (!Array.isArray(body.services)) throw new Error('services must be a list');
    const seen = new Set();
    out.services = JSON.stringify(body.services.filter(s => {
      if (!s || !KEY.test(s.key) || seen.has(s.key)) return false;
      seen.add(s.key);
      return true;
    }).map(s => ({ key: s.key, hours: text(s.hours, 80) })));
  }
  if ('beds' in body) {
    const b = body.beds;
    if (b == null) out.beds = null;
    else {
      const beds = { general: count(b.general), cabin: count(b.cabin), icu: count(b.icu) };
      if (Object.values(beds).some(Number.isNaN)) throw new Error('bed counts must be whole numbers');
      out.beds = Object.values(beds).every(v => v == null) ? null : JSON.stringify(beds);
    }
  }
  if (body.tests != null) {
    if (!Array.isArray(body.tests)) throw new Error('tests must be a list');
    const tests = body.tests.filter(x => text(x?.name)).map(x => {
      // No price means "call for price" (centres that don't publish rates).
      const price = x.price === '' || x.price == null ? null : Number(x.price);
      if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error(`price for "${x.name}" must be a number`);
      if (!TEST_CATEGORIES.includes(x.category)) throw new Error(`category for "${x.name}" must be one of ${TEST_CATEGORIES.join(', ')}`);
      const test = { name: text(x.name, 120), category: x.category, price: price === null ? null : Math.round(price) };
      // Where a published price came from, so the site can link to it.
      const source = sourceUrl(x.source_url);
      if (source) Object.assign(test, { source_url: source, source_checked_on: checkedOn(x.source_checked_on), source_test_name: text(x.source_test_name, 120) });
      return test;
    });
    out.tests = JSON.stringify(tests);
  }
  for (const field of ['facilities', 'payment_methods']) {
    if (body[field] != null) {
      if (!Array.isArray(body[field])) throw new Error(`${field} must be a list`);
      out[field] = JSON.stringify([...new Set(body[field].filter(k => KEY.test(k)))]);
    }
  }
  for (const field of ['opening_hours', 'visiting_hours']) {
    if (field in body) out[field] = text(body[field], 120);
  }
  return out;
}
