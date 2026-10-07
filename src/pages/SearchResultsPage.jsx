import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect } from 'react';
import { SlidersHorizontal, X, Microscope } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import DoctorGrid from '../components/doctor/DoctorGrid';
import HospitalCard from '../components/hospital/HospitalCard';
import FilterDrawer from '../components/search/FilterDrawer';
import { useFilter } from '../context/FilterContext';
import { api } from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import specialtyDetails from '../data/specialtyDetails.json';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';

// Lets plain-language searches reach the right specialists: "heart" finds
// Cardiology via its description, "dialysis" finds Nephrology via its tags.
const SPECIALTY_KEYWORDS = Object.fromEntries(
  Object.entries(specialtyDetails).map(([name, d]) => [name, `${d.description} ${d.tags.join(' ')}`.toLowerCase()])
);

function doctorMatches(d, q) {
  return [
    d.name, d.specialty, d.department, d.city, d.division,
    SPECIALTY_KEYWORDS[d.specialty],
    ...(d.clinical_expertise || []), ...(d.treatments || []),
  ].some(field => (field || '').toLowerCase().includes(q));
}

const TABS = ['doctor', 'hospital', 'diagnostic_center'];
const PAGE_SIZE = 12;

export default function SearchResultsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const { filterParams, setFilterParams, setIsFilterOpen } = useFilter();
  // The tab lives in the URL (?tab=hospital) alongside ?page=, so returning
  // from a profile lands on the same tab and page.
  const activeTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'doctor';
  function setActiveTab(tab) {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (tab === 'doctor') params.delete('tab');
      else params.set('tab', tab);
      return params;
    }, { replace: true });
  }
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
      const q = query.trim().toLowerCase();
      const matchQuery = !q || doctorMatches(d, q);
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

  const results = activeTab === 'hospital' ? filteredHospitals : activeTab === 'doctor' ? filteredDoctors : [];
  const { page, totalPages, setPage, pageItems } = usePagination(
    results,
    PAGE_SIZE,
    JSON.stringify([activeTab, query, filterParams])
  );

  const clearAll = () => { setQuery(''); setFilterParams(p => ({ ...p, specialty: [], city: [], division: [] })); };
  const noResults = (
    <EmptyState
      title={t('no_results')}
      message={t('empty_try_again')}
      actions={[
        { label: t('clear_search_filters'), onClick: clearAll },
        { label: t('browse_specialities'), to: '/specialties' },
        { label: t('browse_hospitals'), to: '/hospitals' },
      ]}
    />
  );

  return (
    <div>
      <PageHeader
        title={query.trim() ? t('results_for', { q: query.trim() }) : t('search_results')}
        count={activeTab === 'diagnostic_center' ? null : results.length}>
        <SearchInput value={query} onChange={setQuery} placeholder={t('search_doctors')} />
      </PageHeader>

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

      {activeTab === 'doctor' && (filteredDoctors.length ? <DoctorGrid doctors={pageItems} /> : noResults)}
      {activeTab === 'hospital' && (filteredHospitals.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pageItems.map(h => <HospitalCard key={h.id} hospital={h} />)}
        </div>
      ) : noResults)}
      {results.length > 0 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
      {activeTab === 'diagnostic_center' && (
        <EmptyState
          icon={Microscope}
          title={t('no_diagnostic_centres')}
          actions={[{ label: t('browse_hospitals'), to: '/hospitals' }]}
        />
      )}

      <FilterDrawer mode="specialty" />
    </div>
  );
}
