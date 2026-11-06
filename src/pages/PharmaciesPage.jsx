import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, MapPin, Phone, Pill, SlidersHorizontal, Truck } from 'lucide-react';
import { api } from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import { filterPharmacies, telHref } from '../utils/pharmacyFilters';
import { phoneDigits } from '../utils/phone';

function PharmacyCard({ pharmacy, lang }) {
  const { t } = useTranslation();
  const place = [pharmacy.address, pharmacy.city].filter(Boolean).join(', ');
  return (
    <li className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/5 p-2.5 text-primary"><Pill size={24} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900">{pharmacy.name}</h2>
          {place && <p className="text-sm text-gray-500 mt-1 flex items-start gap-1"><MapPin size={14} className="shrink-0 mt-1" />{place}</p>}
        </div>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        {pharmacy.opening_hours && <p className="flex items-center gap-1.5"><Clock size={14} />{pharmacy.opening_hours}</p>}
        {pharmacy.home_delivery && <p className="flex items-center gap-1.5 text-primary font-medium"><Truck size={14} />{t('pharmacy_home_delivery')}</p>}
      </div>
      <div className="mt-auto space-y-2">
        {pharmacy.phones.map((phone, i) => (
          <a key={phone} href={telHref(phone)} aria-label={t('pharmacy_call', { name: pharmacy.name, phone })}
            className={`min-h-11 px-3 py-2 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm ${i === 0 ? 'bg-primary text-white hover:bg-primary/90' : 'border border-gray-200 text-primary hover:bg-primary/5'}`}>
            <Phone size={16} /> {i === 0 ? t('pharmacy_call_button') : t('ambulance_alternate')} · <span dir="ltr">{phoneDigits(phone, lang)}</span>
          </a>
        ))}
      </div>
    </li>
  );
}

export default function PharmaciesPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const query = params.get('q') || '';
  const delivery = params.get('delivery') === '1';

  useEffect(() => {
    let active = true;
    api.get('/pharmacies').then(list => { if (active) setPharmacies(list); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }
  const reset = () => setParams({}, { replace: true });

  const visible = filterPharmacies(pharmacies, { query, delivery });
  return (
    <div>
      <PageHeader title={t('pharmacy_title')} />
      <div className="mb-5 bg-primary rounded-2xl text-white p-5 sm:p-7">
        <h2 className="font-bold text-lg sm:text-xl">{t('pharmacy_intro_title')}</h2>
        <p className="text-sm text-white/80 mt-2 max-w-2xl">{t('pharmacy_intro')}</p>
      </div>
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
        <aside className="bg-white rounded-2xl border border-gray-100 p-4 h-fit lg:sticky lg:top-[calc(var(--header-h,80px)+16px)] space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><SlidersHorizontal size={17} />{t('ambulance_filters')}</h2><button type="button" onClick={reset} className="text-sm text-primary min-h-11 px-2">{t('clear_all')}</button></div>
          <SearchInput value={query} onChange={q => update('q', q)} placeholder={t('pharmacy_search')} />
          <label className="flex items-center gap-2 min-h-11 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={delivery} onChange={e => update('delivery', e.target.checked ? '1' : '')} className="h-4 w-4 accent-primary" />
            {t('pharmacy_home_delivery')}
          </label>
        </aside>
        <section aria-label={t('pharmacy_results')} className="min-w-0">
          <p className="text-xs text-gray-500 mb-4">{t('pharmacy_note')}</p>
          {loading ? <p role="status" className="py-16 text-center text-gray-500">{t('loading')}</p> : error ? (
            <EmptyState title={t('pharmacy_load_error')} message={t('ambulance_retry_note')} actions={[{ label: t('retry'), onClick: () => { setLoading(true); setError(false); setReload(n => n + 1); } }]} />
          ) : <>
            <p role="status" className="text-sm text-gray-500 mb-3">{t('pharmacy_results_count', { count: visible.length })}</p>
            {visible.length === 0
              ? <EmptyState title={t('pharmacy_empty')} message={pharmacies.length ? t('pharmacy_empty_note') : t('pharmacy_none_yet')} actions={pharmacies.length ? [{ label: t('clear_search_filters'), onClick: reset }] : []} />
              : <ul className="grid md:grid-cols-2 gap-4">{visible.map(pharmacy => <PharmacyCard key={pharmacy.id} pharmacy={pharmacy} lang={i18n.language} />)}</ul>}
          </>}
        </section>
      </div>
    </div>
  );
}
