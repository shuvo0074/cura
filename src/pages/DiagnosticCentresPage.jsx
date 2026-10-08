import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SearchInput from '../components/ui/SearchInput';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import FilterBar from '../components/filters/FilterBar';
import PillCarousel from '../components/ui/PillCarousel';
import CentreCard from '../components/hospital/CentreCard';
import { api } from '../api/client';

// Same order as the hospitals list: how patients look for them.
const DIVISION_ORDER = ['Dhaka', 'Chattogram', 'Mymensingh', 'Khulna', 'Sylhet', 'Barishal', 'Rangpur', 'Rajshahi'];
const ALL = { id: 'all', name: 'All' };

// Real diagnostic centres, kept apart from hospitals: patients come here for
// a test, so each card leads with the address, hours and a call.
export default function DiagnosticCentresPage() {
  const { t } = useTranslation();
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  function setQuery(value) {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      if (value) next.set('q', value); else next.delete('q');
      return next;
    }, { replace: true });
  }
  const [division, setDivision] = useState(ALL);

  useEffect(() => {
    api.get('/hospitals')
      .then(list => setCentres(list.filter(h => h.type === 'diagnostic')))
      .finally(() => setLoading(false));
  }, []);

  // Only offer divisions that have a centre.
  const pills = useMemo(() => [ALL, ...DIVISION_ORDER
    .filter(d => centres.some(c => c.division === d))
    .map(d => ({ id: d.toLowerCase(), name: d }))], [centres]);

  const q = query.trim().toLowerCase();
  const visible = centres.filter(c =>
    (division.id === 'all' || c.division === division.name)
    && (!q || [c.name, c.location, c.division, c.address, ...(c.tests || []).map(test => test.name)].some(v => (v || '').toLowerCase().includes(q))));

  const search = <SearchInput value={query} onChange={setQuery} placeholder={t('search_diagnostic')} />;

  return (
    <div>
      <PageHeader title={t('diagnostic_centres')} count={visible.length} controlsOnMobile={false}>
        {search}
      </PageHeader>
      <p className="text-sm text-gray-600 -mt-2 mb-4 max-w-2xl">{t('diagnostic_centres_sub')}</p>
      {visible.some(c => c.tests?.some(test => test.price_kind === 'demo')) && <p className="text-xs text-gray-500 mb-4">{t('test_prices_demo_note')}</p>}
      <FilterBar search={<SearchInput value={query} onChange={setQuery} placeholder={t('search_diagnostic')} className="h-11 py-0" />} />

      <div className="mb-4 sm:mb-6">
        <PillCarousel items={pills} onSelect={setDivision} selected={division} />
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-16">{t('loading')}</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('no_centres_match')}
          message={t('empty_try_again')}
          actions={[{ label: t('clear_search_filters'), onClick: () => { setQuery(''); setDivision(ALL); } }]}
        />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(c => <CentreCard key={c.id} centre={c} />)}
        </ul>
      )}
    </div>
  );
}
