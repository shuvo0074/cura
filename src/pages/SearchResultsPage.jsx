import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import DoctorGrid from '../components/doctor/DoctorGrid';
import HospitalCard from '../components/hospital/HospitalCard';
import FilterDrawer from '../components/search/FilterDrawer';
import { useFilter } from '../context/FilterContext';
import { api } from '../api/client';

const TABS = ['doctor', 'hospital', 'diagnostic_center'];

export default function SearchResultsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const { filterParams, setFilterParams, setIsFilterOpen } = useFilter();
  const [activeTab, setActiveTab] = useState('doctor');
  const [query, setQuery] = useState(urlQuery);
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    api.get('/doctors').then(setDoctors);
    api.get('/hospitals').then(setHospitals);
  }, []);

  // A fresh search arriving via navigation (e.g. the home page search bar)
  // should start clean — otherwise a specialty/city filter left checked
  // from earlier browsing silently ANDs against the new query and can
  // produce "No Results Found" with no indication why. Typing directly in
  // this page's own search box does NOT trigger this (see below), so a
  // filter can still be intentionally combined with in-page typing.
  useEffect(() => {
    setQuery(urlQuery);
    setFilterParams(p => ({ ...p, specialty: [], city: [], division: [] }));
  }, [urlQuery]);

  const activeFilterChips = [
    ...filterParams.specialty.map(v => ({ key: 'specialty', value: v })),
    ...filterParams.city.map(v => ({ key: 'city', value: v })),
    ...filterParams.division.map(v => ({ key: 'division', value: `${v} Division` , raw: v })),
  ];

  function removeChip(key, value) {
    setFilterParams(p => ({ ...p, [key]: p[key].filter(v => v !== value) }));
  }

  const filteredDoctors = useMemo(() => {
    return doctors.filter(d => {
      const q = query.toLowerCase();
      const matchQuery = !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.city.toLowerCase().includes(q) || (d.division || '').toLowerCase().includes(q);
      const matchCity = !filterParams.city.length || filterParams.city.includes(d.city);
      const matchDivision = !filterParams.division.length || filterParams.division.includes(d.division);
      const matchSpec = !filterParams.specialty.length || filterParams.specialty.includes(d.specialty);
      return matchQuery && matchCity && matchDivision && matchSpec;
    });
  }, [doctors, query, filterParams]);

  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
      const q = query.toLowerCase();
      return !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q) || (h.division || '').toLowerCase().includes(q);
    });
  }, [hospitals, query]);

  return (
    <div>
      <div className="max-w-xl mb-4">
        <SearchInput value={query} onChange={setQuery} placeholder={t('search_doctors')} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${activeTab === tab ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}>
              {t(tab)}
            </button>
          ))}
        </div>

        <button onClick={() => setIsFilterOpen(true)}
          className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg bg-white">
          <SlidersHorizontal size={13} /> {t('filter_by')}
        </button>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-gray-400">Filtering by:</span>
          {activeFilterChips.map(({ key, value, raw = value }) => (
            <button key={`${key}-${value}`} onClick={() => removeChip(key, raw)}
              className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full hover:bg-primary/20 transition-colors">
              {value} <X size={12} />
            </button>
          ))}
          <button
            onClick={() => setFilterParams(p => ({ ...p, specialty: [], city: [], division: [] }))}
            className="text-xs text-gray-400 hover:text-primary underline">
            Clear all
          </button>
        </div>
      )}

      {activeTab === 'doctor' && <DoctorGrid doctors={filteredDoctors} />}
      {activeTab === 'hospital' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredHospitals.map(h => <HospitalCard key={h.id} hospital={h} />)}
        </div>
      )}
      {activeTab === 'diagnostic_center' && (
        <p className="text-center text-gray-400 py-16">{t('no_results')}</p>
      )}

      <FilterDrawer mode="specialty" />
    </div>
  );
}
