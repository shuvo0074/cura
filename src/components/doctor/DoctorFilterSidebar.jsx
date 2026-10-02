import { useState } from 'react';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import { useFilter } from '../../context/FilterContext';
import divisions from '../../data/divisions.json';
import { citiesForDivisions, toggleDivision } from '../../utils/geo';

function FilterSection({ title, searchValue = '', onSearchChange, items, selected, onToggle, searchable = true }) {
  const filtered = items.filter(i => i.toLowerCase().includes(searchValue.toLowerCase()));
  return (
    <div className="border-b border-gray-100 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
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
      <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
        {filtered.map(item => (
          <label key={item} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
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

export default function DoctorFilterSidebar({ specialtyNames = [], symptomNames = [], mode = 'specialty' }) {
  const { filterParams, setFilterParams } = useFilter();
  const [specSearch, setSpecSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSymptomMode = mode === 'symptom';
  const cities = citiesForDivisions(filterParams.division);
  const activeCount =
    filterParams.specialty.length +
    filterParams.city.length +
    filterParams.division.length +
    filterParams.symptom.length;

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
      {/* ── Mobile: filter pill button ── */}
      <div className="md:hidden mb-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl px-4 py-2.5 shadow-sm active:bg-gray-50">
          <SlidersHorizontal size={15} className="text-primary" />
          Filters
          {activeCount > 0 && (
            <span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile: bottom sheet ── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-white rounded-t-2xl max-h-[82vh] flex flex-col">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="font-semibold text-gray-900 text-base">Filters</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-gray-400 p-1 rounded-full hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {sections}
            </div>
            {/* Footer actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={clearAll}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm text-gray-600 font-medium active:bg-gray-50">
                Clear All
              </button>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-semibold active:bg-primary/90">
                Show Results
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Desktop: sticky sidebar ── */}
      <aside className="hidden md:block w-64 flex-shrink-0">
        <div
          className="bg-white rounded-xl shadow-sm p-4 sticky top-20 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 6rem)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
              <SlidersHorizontal size={15} /> Filter By
            </span>
            <button onClick={clearAll} className="text-xs text-primary font-medium">
              Clear All
            </button>
          </div>
          {sections}
        </div>
      </aside>
    </>
  );
}
