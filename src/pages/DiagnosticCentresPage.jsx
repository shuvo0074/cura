import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, House, MapPin, Phone, ReceiptText } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import FilterBar from '../components/filters/FilterBar';
import PillCarousel from '../components/ui/PillCarousel';
import CentreBanner from '../components/hospital/CentreBanner';
import { is24x7 } from '../components/hospital/hospitalCatalogue';
import { api } from '../api/client';

// Same order as the hospitals list: how patients look for them.
const DIVISION_ORDER = ['Dhaka', 'Chattogram', 'Mymensingh', 'Khulna', 'Sylhet', 'Barishal', 'Rangpur', 'Rajshahi'];
const ALL = { id: 'all', name: 'All' };

function CentreCard({ centre }) {
  const { t } = useTranslation();
  const homeSample = (centre.services || []).some(s => s.key === 'home_sample');
  return (
    <li className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <Link to={`/diagnostic-centres/${centre.id}`} tabIndex={-1} aria-hidden="true">
        <CentreBanner centre={centre} className="w-full h-32" />
      </Link>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <Link to={`/diagnostic-centres/${centre.id}`} className="font-semibold text-gray-900 leading-snug hover:text-primary">{centre.name}</Link>
            <p className="flex items-start gap-1.5 text-sm text-gray-500 mt-1">
              <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" /> {centre.address}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {centre.opening_hours && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${is24x7(centre.opening_hours) ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
              <Clock size={12} /> {is24x7(centre.opening_hours) ? t('open_24_hours') : centre.opening_hours}
            </span>
          )}
          {homeSample && (
            <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 bg-primary/5 text-primary">
              <House size={12} /> {t('home_sample_short')}
            </span>
          )}
        </div>
        <div className="flex gap-2 mt-auto">
          {centre.hotline && (
            <a href={`tel:${centre.hotline}`}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
              <Phone size={15} /> {t('call')} {centre.hotline}
            </a>
          )}
          <Link to={`/diagnostic-centres/${centre.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary">
            <ReceiptText size={15} /> {t('jump_tests')}
          </Link>
        </div>
      </div>
    </li>
  );
}

// Real diagnostic centres, kept apart from hospitals: patients come here for
// a test, so each card leads with the address, hours and a call.
export default function DiagnosticCentresPage() {
  const { t } = useTranslation();
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
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
    && (!q || [c.name, c.location, c.division, c.address].some(v => (v || '').toLowerCase().includes(q))));

  const search = <SearchInput value={query} onChange={setQuery} placeholder={t('search_diagnostic')} />;

  return (
    <div>
      <PageHeader title={t('diagnostic_centres')} count={visible.length} controlsOnMobile={false}>
        {search}
      </PageHeader>
      <p className="text-sm text-gray-600 -mt-2 mb-4 max-w-2xl">{t('diagnostic_centres_sub')}</p>
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
