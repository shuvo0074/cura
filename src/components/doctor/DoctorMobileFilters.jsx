import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFilter } from '../../context/FilterContext';
import { EMPTY_FILTERS } from '../../utils/doctorFilters';
import divisions from '../../data/divisions.json';
import { citiesForDivisions, toggleDivision } from '../../utils/geo';
import FilterBar from '../filters/FilterBar';
import FilterSheet from '../filters/FilterSheet';

function toggleIn(list, item) {
  return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
}

// Phone filters for doctor lists: sticky FilterBar + FilterSheet over the
// shared filter context. `countFor(draft)` lets the sheet's button preview
// how many doctors a draft would show; pages pass their own matcher.
//
//   mode        'specialty' | 'symptom' — which list section to offer
//   mobileOnly  hide the bar from `md` up, where a sidebar takes over
//   search, leading  passed through to FilterBar
//   scope       filters that define the page itself (e.g. the specialty on
//               /specialties/cardiology): not shown as chips, and Clear
//               resets to them instead of wiping them
export default function DoctorMobileFilters({ mode = 'specialty', specialtyNames = [], symptomNames = [], countFor, mobileOnly = true, search, leading, scope = EMPTY_FILTERS }) {
  const { t } = useTranslation();
  const { filterParams, setFilterParams } = useFilter();
  const [open, setOpen] = useState(false);
  const listKey = mode === 'symptom' ? 'symptom' : 'specialty';

  const chips = [
    ...filterParams[listKey].map(value => ({ key: listKey, value })),
    ...filterParams.division.map(value => ({ key: 'division', value, label: t('division_label', { name: value }) })),
    ...filterParams.city.map(value => ({ key: 'city', value })),
  ].filter(({ key, value }) => !scope[key].includes(value));

  const toggle = (params, key, option) =>
    key === 'division' ? toggleDivision(params, option) : { ...params, [key]: toggleIn(params[key], option) };

  return (
    <>
      <FilterBar
        mobileOnly={mobileOnly}
        search={search}
        leading={leading}
        chips={chips}
        onOpen={() => setOpen(true)}
        onRemove={(key, value) => setFilterParams(p => toggle(p, key, value))}
        onClearAll={() => setFilterParams(scope)}
      />
      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('filters')}
        value={filterParams}
        onApply={setFilterParams}
        emptyValue={scope}
        toggle={toggle}
        countFor={countFor}
        resultLabel={count => t('show_n_doctors', { count })}
        getSections={draft => [
          mode === 'symptom'
            ? { key: 'symptom', title: t('symptoms'), options: symptomNames, searchable: true, searchPlaceholder: t('search_symptoms') }
            : { key: 'specialty', title: t('specialities'), options: specialtyNames, searchable: true, searchPlaceholder: t('search_specialities') },
          { key: 'division', title: t('division'), options: divisions },
          {
            key: 'city',
            title: t('city'),
            options: citiesForDivisions(draft.division),
            searchable: true,
            searchPlaceholder: t('search_city'),
            hint: draft.division.length ? t('cities_in_divisions') : null,
          },
        ]}
      />
    </>
  );
}
