export const EMPTY_FILTERS = { specialty: [], city: [], division: [], symptom: [], hospital: [] };

// Whether a doctor passes the shared specialty/division/city filters. Used by
// the list itself and by the filter sheet to preview a draft's result count.
export function matchesDoctorFilters(d, p) {
  return (!p.city.length || p.city.includes(d.city))
    && (!p.division.length || p.division.includes(d.division))
    && (!p.specialty.length || p.specialty.includes(d.specialty));
}
