import { distanceKm } from './distance.js';

export const AMBULANCE_CATEGORIES = ['ac', 'non_ac', 'freezer', 'icu'];
export const AMBULANCE_FEATURES = ['24_hours', 'oxygen', 'medical_team', 'interdistrict'];

export function filterAmbulances(vendors, { category = '', area = '', features = [], query = '' }, areas) {
  const byId = Object.fromEntries(areas.map(a => [a.id, a]));
  const pickup = byId[area];
  const q = query.trim().toLowerCase();
  return vendors.filter(v =>
    (!category || v.categories.includes(category))
    && (!area || v.dhaka_wide || v.service_areas.includes(area))
    && features.every(f => v.features.includes(f))
    && (!q || [v.name, v.name_bn, v.address, v.address_bn, ...v.phones, byId[v.base_area]?.en, byId[v.base_area]?.bn]
      .some(value => value?.toLowerCase().includes(q))))
    .map(v => ({ ...v, areaDistance: pickup && byId[v.base_area] ? distanceKm(pickup, byId[v.base_area]) : null }))
    .sort((a, b) => (a.areaDistance ?? Infinity) - (b.areaDistance ?? Infinity) || a.name.localeCompare(b.name));
}
