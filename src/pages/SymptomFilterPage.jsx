import { useParams } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';
import DoctorCardWide from '../components/doctor/DoctorCardWide';
import DoctorFilterSidebar from '../components/doctor/DoctorFilterSidebar';
import { useFilter } from '../context/FilterContext';
import { api } from '../api/client';
import symptoms from '../data/symptoms.json';

// Lowercases and folds curly apostrophes to straight ones, since doctor
// profile data (clinical_expertise/treatments) uses curly quotes (e.g.
// "Parkinson’s Disease") while symptoms.json uses straight ones.
function normalize(str) {
  return (str || '').toLowerCase().replace(/[‘’]/g, "'");
}

export default function SymptomFilterPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { filterParams, setFilterParams } = useFilter();
  const [query, setQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const symptom = symptoms.find(s => s.slug === slug);

  useEffect(() => {
    api.get('/doctors').then(setDoctors).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (symptom) setFilterParams(p => ({ ...p, symptom: [symptom.name] }));
  }, [slug]);

  const symptomNames = useMemo(() => symptoms.map(s => s.name), []);

  const filtered = useMemo(() => {
    return doctors.filter(d => {
      const q = query.toLowerCase();
      const matchQ = !q || d.name.toLowerCase().includes(q);
      const matchCity = !filterParams.city.length || filterParams.city.includes(d.city);
      const matchDivision = !filterParams.division.length || filterParams.division.includes(d.division);
      const matchSymptom = !filterParams.symptom.length || filterParams.symptom.some(sym => {
        const s = normalize(sym);
        if (normalize(d.specialty).includes(s) || normalize(d.name).includes(s) || normalize(d.about).includes(s)) {
          return true;
        }
        // clinical_expertise/treatments are short discrete phrases (e.g. "COPD",
        // "Hepatitis") rather than prose, so match either direction: the symptom
        // name may embed an acronym ("...(COPD)") that equals a short entry, or
        // an entry may be a broader phrase containing the symptom name.
        const entries = [...(d.clinical_expertise || []), ...(d.treatments || [])];
        return entries.some(entry => {
          const e = normalize(entry);
          return s.includes(e) || e.includes(s);
        });
      });
      return matchQ && matchCity && matchDivision && matchSymptom;
    });
  }, [doctors, query, filterParams]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <DoctorFilterSidebar symptomNames={symptomNames} mode="symptom" />

      <div className="flex-1 min-w-0">
        <PageHeader title={filterParams.symptom.length ? filterParams.symptom.join(', ') : symptom?.name || slug} count={filtered.length}>
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
