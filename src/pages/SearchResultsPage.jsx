import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
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
  const { filterParams, setIsFilterOpen } = useFilter();
  const [activeTab, setActiveTab] = useState('doctor');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    api.get('/doctors').then(setDoctors);
    api.get('/hospitals').then(setHospitals);
  }, []);

  const filteredDoctors = useMemo(() => {
    return doctors.filter(d => {
      const q = query.toLowerCase();
      const matchQuery = !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.city.toLowerCase().includes(q);
      const matchCity = !filterParams.city.length || filterParams.city.includes(d.city);
      const matchSpec = !filterParams.specialty.length || filterParams.specialty.includes(d.specialty);
      return matchQuery && matchCity && matchSpec;
    });
  }, [doctors, query, filterParams]);

  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
      const q = query.toLowerCase();
      return !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q);
    });
  }, [hospitals, query]);

  return (
    <div>
      <div className="max-w-xl mb-4">
        <SearchInput value={query} onChange={setQuery} placeholder={t('search_doctors')} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
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
