import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';
import DoctorCardWide from '../components/doctor/DoctorCardWide';
import DoctorFilterSidebar from '../components/doctor/DoctorFilterSidebar';
import { useFilter } from '../context/FilterContext';
import { api } from '../api/client';
import specialties from '../data/specialties.json';

export default function SpecialtyPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { filterParams, setFilterParams } = useFilter();
  const [query, setQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const specialty = specialties.find(s => s.slug === slug);

  useEffect(() => {
    api.get('/doctors').then(setDoctors).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (specialty) setFilterParams(p => ({ ...p, specialty: [specialty.name] }));
  }, [slug]);

  const specialtyNames = useMemo(
    () => [...new Set(doctors.map(d => d.specialty))].sort(),
    [doctors]
  );

  const filtered = useMemo(() => {
    return doctors.filter(d => {
      const q = query.toLowerCase();
      const matchQ = !q || d.name.toLowerCase().includes(q);
      const matchCity = !filterParams.city.length || filterParams.city.includes(d.city);
      const matchDivision = !filterParams.division.length || filterParams.division.includes(d.division);
      const matchSpec = !filterParams.specialty.length || filterParams.specialty.includes(d.specialty);
      return matchQ && matchCity && matchDivision && matchSpec;
    });
  }, [doctors, query, filterParams]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <DoctorFilterSidebar specialtyNames={specialtyNames} />

      <div className="flex-1 min-w-0">
        <PageHeader title={filterParams.specialty.length ? filterParams.specialty.join(', ') : specialty?.name || slug} count={filtered.length}>
          <SearchInput value={query} onChange={setQuery} placeholder={t('search_doctors')} />
        </PageHeader>

        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t('no_results')}
            message={t('empty_try_again')}
            actions={[
              { label: t('clear_search_filters'), onClick: () => { setQuery(''); setFilterParams(p => ({ ...p, city: [], division: [] })); } },
              { label: t('browse_specialities'), to: '/specialties' },
            ]}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(d => <DoctorCardWide key={d.id} doctor={d} />)}
          </div>
        )}
      </div>
    </div>
  );
}
