import { useSearchParams, useNavigationType } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Microscope } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import DoctorGrid from '../components/doctor/DoctorGrid';
import HospitalCard from '../components/hospital/HospitalCard';
import DoctorMobileFilters from '../components/doctor/DoctorMobileFilters';
import FilterBar from '../components/filters/FilterBar';
import { matchesDoctorFilters } from '../utils/doctorFilters';
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
  const query = searchParams.get('q') || '';
  const navigationType = useNavigationType();
  const { filterParams, setFilterParams } = useFilter();
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
  // The search box writes straight to ?q= (replacing, not pushing, so typing
  // doesn't flood history). Back from a profile then restores exactly what
  // was typed, together with ?tab= and ?page=.
  const typedQuery = useRef(null);
  function setQuery(value) {
    typedQuery.current = value;
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (value) params.set('q', value);
      else params.delete('q');
      params.delete('page');
      return params;
    }, { replace: true });
  }
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
  // Back/Forward (POP) also keeps filters, so returning from a profile shows
  // the same filtered results and page the user left.
  useEffect(() => {
    if (navigationType === 'POP' || query === typedQuery.current) return;
    setFilterParams(p => ({ ...p, specialty: [], city: [], division: [] }));
  }, [query]);

  const q = query.trim().toLowerCase();
  const countFor = params => doctors.filter(d => (!q || doctorMatches(d, q)) && matchesDoctorFilters(d, params)).length;
  const specialtyNames = useMemo(() => [...new Set(doctors.map(d => d.specialty))].sort(), [doctors]);

  const filteredDoctors = useMemo(
    () => doctors.filter(d => (!q || doctorMatches(d, q)) && matchesDoctorFilters(d, filterParams)),
    [doctors, q, filterParams]
  );

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

  const tabs = (
    <div role="tablist" className="flex gap-2 overflow-x-auto no-scrollbar">
      {TABS.map(tab => (
        <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
          className={`flex-shrink-0 h-10 px-4 rounded-full text-sm font-medium border transition-colors
            ${activeTab === tab ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}>
          {t(tab)}
        </button>
      ))}
    </div>
  );
  const barSearch = <SearchInput value={query} onChange={setQuery} placeholder={t('search_doctors')} className="h-11 py-0" />;

  return (
    <div>
      <PageHeader
        title={query.trim() ? t('results_for', { q: query.trim() }) : t('search_results')}
        count={activeTab === 'diagnostic_center' ? null : results.length}
        controlsOnMobile={false}>
        <SearchInput value={query} onChange={setQuery} placeholder={t('search_doctors')} />
      </PageHeader>

      {/* Phones: search + filters in the sticky bar, tabs just below it.
          Desktop: tabs + filters share the sticky bar; search stays in the header.
          Specialty/division/city filters only apply to doctors. */}
      {activeTab === 'doctor' ? (
        <DoctorMobileFilters specialtyNames={specialtyNames} countFor={countFor} mobileOnly={false} search={barSearch} leading={tabs} />
      ) : (
        <FilterBar search={barSearch} leading={tabs} />
      )}
      <div className="md:hidden mb-3">{tabs}</div>

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

    </div>
  );
}
