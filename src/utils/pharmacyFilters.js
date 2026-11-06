// Search pharmacies by name or area (address or city), optionally only those
// that deliver. Matching ignores case and extra spaces.
const normalize = value => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export function filterPharmacies(pharmacies, { query = '', delivery = false } = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return pharmacies.filter(pharmacy => {
    if (delivery && !pharmacy.home_delivery) return false;
    const haystack = normalize([pharmacy.name, pharmacy.address, pharmacy.city].join(' '));
    return words.every(word => haystack.includes(word));
  });
}

// Search a pharmacy's medicines by name, strength or form.
export function filterStock(items, query = '') {
  const words = normalize(query).split(' ').filter(Boolean);
  return items.filter(item => {
    const haystack = normalize([item.name, item.strength, item.form].join(' '));
    return words.every(word => haystack.includes(word));
  });
}

// Pharmacy orders the patient can still act on or is waiting for come first.
export const isOpenOrder = order => order.status === 'new' || order.status === 'ready';

// The newest order for each prescription, to show its status next to it.
export function latestOrderByPrescription(orders) {
  const latest = {};
  for (const order of orders) {
    if (!order.prescription_id) continue;
    const seen = latest[order.prescription_id];
    if (!seen || order.created_at > seen.created_at) latest[order.prescription_id] = order;
  }
  return latest;
}

// The i18n key for an error from the pharmacy order API, by its code.
export function orderErrorKey(err) {
  const known = { ALREADY_SENT: 'po_err_already_sent', TOO_MANY_ORDERS: 'po_err_too_many', ORDER_STATUS: 'po_err_status', NOT_FOUND: 'po_err_not_found' };
  return known[err?.code] ?? 'po_err_generic';
}

// A dialable link for a Bangladeshi number as owners type it.
export function telHref(phone) {
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('880')) return `tel:+${digits}`;
  if (digits.startsWith('0')) return `tel:+88${digits}`;
  return `tel:${digits}`;
}
