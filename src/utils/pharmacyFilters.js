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

// A dialable link for a Bangladeshi number as owners type it.
export function telHref(phone) {
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('880')) return `tel:+${digits}`;
  if (digits.startsWith('0')) return `tel:+88${digits}`;
  return `tel:${digits}`;
}
