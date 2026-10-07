import { useState } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import { useFilter } from '../../context/FilterContext';
import divisions from '../../data/divisions.json';
import { citiesForDivisions, toggleDivision } from '../../utils/geo';

function FilterSection({ title, searchValue = '', onSearchChange, items, selected, onToggle, searchable = true }) {
  const filtered = items.filter(i => i.toLowerCase().includes(searchValue.toLowerCase()));
  return (
    <div className="border-b border-gray-100 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
      <p className="text-sm font-semibold text-gray-800 mb-2">{title}</p>
      {searchable && (
        <div className="field flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
            aria-label={`Search ${title.toLowerCase()}`}
            className="flex-1 min-w-0 text-xs outline-none bg-transparent"
          />
        </div>
      )}
      <div className="flex flex-col max-h-36 overflow-y-auto pr-1">
        {filtered.map(item => (
          <label key={item} className="flex items-center gap-2.5 py-1 text-sm text-gray-600 hover:text-gray-900 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => onToggle(item)}
              className="accent-primary w-4 h-4 flex-shrink-0"
            />
            {item}
          </label>
        ))}
        {filtered.length === 0 && <p className="text-xs text-gray-400">No matches.</p>}
      </div>
    </div>
  );
}

function toggleInArray(arr, item) {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

// Desktop filter sidebar (md and up). Phones use DoctorMobileFilters.
export default function DoctorFilterSidebar({ specialtyNames = [], symptomNames = [], mode = 'specialty' }) {
  const { filterParams, setFilterParams } = useFilter();
  const [specSearch, setSpecSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  const isSymptomMode = mode === 'symptom';
  const cities = citiesForDivisions(filterParams.division);

  function clearAll() {
    setFilterParams({ specialty: [], city: [], division: [], symptom: [], hospital: [] });
  }

  const sections = (
    <>
      {isSymptomMode ? (
        <FilterSection
          title="Symptoms"
          searchValue={specSearch}
          onSearchChange={setSpecSearch}
          items={symptomNames}
          selected={filterParams.symptom}
          onToggle={v => setFilterParams(p => ({ ...p, symptom: toggleInArray(p.symptom, v) }))}
        />
      ) : (
        <FilterSection
          title="Specialities"
          searchValue={specSearch}
          onSearchChange={setSpecSearch}
          items={specialtyNames}
          selected={filterParams.specialty}
          onToggle={v => setFilterParams(p => ({ ...p, specialty: toggleInArray(p.specialty, v) }))}
        />
      )}

      <FilterSection
        title="Division"
        searchable={false}
        items={divisions}
        selected={filterParams.division}
        onToggle={v => setFilterParams(p => toggleDivision(p, v))}
      />

      <FilterSection
        title="City"
        searchValue={citySearch}
        onSearchChange={setCitySearch}
        items={cities}
        selected={filterParams.city}
        onToggle={v => setFilterParams(p => ({ ...p, city: toggleInArray(p.city, v) }))}
      />
    </>
  );

  return (
    <>
      {/* ── Desktop: sticky sidebar ── */}
      <aside className="hidden md:block w-64 flex-shrink-0">
        <div
          className="bg-white rounded-xl shadow-sm p-4 sticky top-20 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 6rem)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
              <SlidersHorizontal size={15} /> Filter By
            </span>
            <button onClick={clearAll} className="text-xs text-primary font-medium rounded-md px-2 py-1.5 -mr-2 hover:bg-primary/5">
              Clear All
            </button>
          </div>
          {sections}
        </div>
      </aside>
    </>
  );
}
