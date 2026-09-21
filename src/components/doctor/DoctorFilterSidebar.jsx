import { useState } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import { useFilter } from '../../context/FilterContext';
import divisions from '../../data/divisions.json';
import { citiesForDivisions, toggleDivision } from '../../utils/geo';

function FilterSection({ title, searchValue = '', onSearchChange, items, selected, onToggle, searchable = true }) {
  const filtered = items.filter(i => i.toLowerCase().includes(searchValue.toLowerCase()));
  return (
    <div className="border-b border-gray-100 pb-3 mb-3">
      <p className="text-sm font-semibold text-gray-800 mb-2">{title}</p>
      {searchable && (
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={`Search ${title}`}
            className="flex-1 text-xs outline-none bg-transparent"
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1">
        {filtered.map(item => (
          <label key={item} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => onToggle(item)}
              className="accent-primary"
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

export default function DoctorFilterSidebar({ specialtyNames, symptomNames, mode = 'specialty' }) {
  const { filterParams, setFilterParams } = useFilter();
  const [specSearch, setSpecSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  const isSymptomMode = mode === 'symptom';
  const cities = citiesForDivisions(filterParams.division);

  return (
    <aside className="w-full md:w-64 flex-shrink-0">
      <div className="bg-white rounded-xl shadow-sm p-4 md:sticky md:top-20 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
            <SlidersHorizontal size={15} /> Filter By
          </span>
          <button
            onClick={() => setFilterParams({ specialty: [], city: [], division: [], symptom: [], hospital: [] })}
            className="text-xs text-primary font-medium">
            Clear All
          </button>
        </div>

        {isSymptomMode ? (
          <FilterSection
            title="Symptoms"
            searchValue={specSearch}
            onSearchChange={setSpecSearch}
            items={symptomNames}
            selected={filterParams.symptom}
            onToggle={value => setFilterParams(p => ({ ...p, symptom: toggleInArray(p.symptom, value) }))}
          />
        ) : (
          <FilterSection
            title="Specialities"
            searchValue={specSearch}
            onSearchChange={setSpecSearch}
            items={specialtyNames}
            selected={filterParams.specialty}
            onToggle={value => setFilterParams(p => ({ ...p, specialty: toggleInArray(p.specialty, value) }))}
          />
        )}

        <FilterSection
          title="Select Division"
          searchable={false}
          items={divisions}
          selected={filterParams.division}
          onToggle={value => setFilterParams(p => toggleDivision(p, value))}
        />

        <FilterSection
          title="Select City"
          searchValue={citySearch}
          onSearchChange={setCitySearch}
          items={cities}
          selected={filterParams.city}
          onToggle={value => setFilterParams(p => ({ ...p, city: toggleInArray(p.city, value) }))}
        />
      </div>
    </aside>
  );
}
