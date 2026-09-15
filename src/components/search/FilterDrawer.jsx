import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFilter } from '../../context/FilterContext';

const CITIES = ['Dhaka', 'Sylhet', 'Mymensingh', 'Chittagong', 'Rajshahi'];
const SPECIALTIES = ['ENT', 'Cardiology', 'Pediatrics', 'Gynecology', 'Dermatology', 'General Physician'];
const SYMPTOMS = ['Fever', 'Body Ache', 'Sore Throat', 'Asthma', 'Back Pain', 'Diabetes'];

function toggleInArray(arr, item) {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

export default function FilterDrawer({ mode = 'specialty' }) {
  const { t } = useTranslation();
  const { isFilterOpen, setIsFilterOpen, filterParams, setFilterParams } = useFilter();
  const [specSearch, setSpecSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  const listItems = mode === 'symptom' ? SYMPTOMS : SPECIALTIES;
  const filteredList = listItems.filter(s => s.toLowerCase().includes(specSearch.toLowerCase()));
  const filteredCities = CITIES.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));
  const listKey = mode === 'symptom' ? 'symptom' : 'specialty';
  const selectedList = filterParams[listKey];

  if (!isFilterOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setIsFilterOpen(false)}>
      <div
        className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-gray-800">{t('filter')}</span>
          <button onClick={() => setIsFilterOpen(false)} className="text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 flex flex-col gap-2 border-b" style={{ maxHeight: '50%' }}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {mode === 'symptom' ? 'Symptoms' : 'Specialty'}
            </p>
            <input
              placeholder={`Search...`}
              value={specSearch}
              onChange={e => setSpecSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
            />
            <div className="overflow-y-auto flex flex-col gap-1">
              {filteredList.map(item => (
                <button
                  key={item}
                  onClick={() => setFilterParams(p => ({ ...p, [listKey]: toggleInArray(p[listKey], item) }))}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors
                    ${selectedList.includes(item)
                      ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 flex flex-col gap-2" style={{ maxHeight: '50%' }}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City</p>
            <input
              placeholder="Search city..."
              value={citySearch}
              onChange={e => setCitySearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
            />
            <div className="overflow-y-auto flex flex-col gap-1">
              {filteredCities.map(city => (
                <button
                  key={city}
                  onClick={() => setFilterParams(p => ({ ...p, city: toggleInArray(p.city, city) }))}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors
                    ${filterParams.city.includes(city)
                      ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                  {city}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t">
          <button
            onClick={() => { setFilterParams({ specialty: [], city: [], symptom: [], hospital: [] }); setIsFilterOpen(false); }}
            className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}
