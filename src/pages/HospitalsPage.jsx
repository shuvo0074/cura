import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect } from 'react';
import SearchInput from '../components/ui/SearchInput';
import HospitalCard from '../components/hospital/HospitalCard';
import PillCarousel from '../components/ui/PillCarousel';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import { api } from '../api/client';
import divisions from '../data/divisions.json';

const CITIES = [
  { id: 'all', name: 'All' },
  ...divisions.map(d => ({ id: d.toLowerCase(), name: d })),
];

const PAGE_SIZE = 12;

export default function HospitalsPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/hospitals').then(setHospitals).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return hospitals.filter(h => {
      const q = query.toLowerCase();
      const matchQ = !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q) || (h.division || '').toLowerCase().includes(q);
      const matchCity = selectedCity.id === 'all' || h.division === selectedCity.name;
      return matchQ && matchCity;
    });
  }, [hospitals, query, selectedCity]);

  const { page, totalPages, setPage, pageItems } = usePagination(
    filtered,
    PAGE_SIZE,
    `${query}|${selectedCity.id}`
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('hospitals')}</h1>
        <div className="max-w-md w-full">
          <SearchInput value={query} onChange={setQuery} placeholder={t('search_location_hospital')} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{t('all_hospital')} {filtered.length}</span>
      </div>
      <div className="mb-6">
        <PillCarousel items={CITIES} onSelect={setSelectedCity} selected={selectedCity} />
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-16">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-16">{t('no_results')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageItems.map(h => <HospitalCard key={h.id} hospital={h} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
