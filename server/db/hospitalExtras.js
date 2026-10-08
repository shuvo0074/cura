// Hospital services, beds, test prices, facilities, payment methods and hours
// (see schema.sql), as SQL parameters in this column order.
export const HOSPITAL_EXTRA_COLUMNS = ['type', 'services', 'beds', 'tests', 'facilities', 'payment_methods', 'opening_hours', 'visiting_hours'];

export function hospitalExtras(h) {
  const json = v => (v == null ? null : JSON.stringify(v));
  return [h.type || null, json(h.services), json(h.beds), json(h.tests), json(h.facilities), json(h.paymentMethods),
    h.openingHours || null, h.visitingHours || null];
}
