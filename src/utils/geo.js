import divisions from '../data/divisions.json';
import divisionCities from '../data/divisionCities.json';

// Cities offered by the City filter: those of the selected divisions, or all of them when none is selected.
export function citiesForDivisions(selected) {
  const list = selected.length ? selected : divisions;
  return list.flatMap(d => divisionCities[d] || []).sort((a, b) => a.localeCompare(b));
}

// Toggles a division in the shared filter params and drops any selected city that no longer belongs
// to the selected divisions, so a hidden city can't keep silently filtering the results.
export function toggleDivision(params, division) {
  const next = params.division.includes(division)
    ? params.division.filter(d => d !== division)
    : [...params.division, division];
  const allowed = new Set(citiesForDivisions(next));
  return { ...params, division: next, city: params.city.filter(c => allowed.has(c)) };
}
