import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocateFixed, SlidersHorizontal } from 'lucide-react';
import { api } from '../api/client';
import EmergencySection from '../components/home/EmergencySection';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import AmbulanceVendorCard from '../components/AmbulanceVendorCard';
import areas from '../data/dhakaAreas.json';
import { AMBULANCE_CATEGORIES, AMBULANCE_FEATURES, filterAmbulances } from '../utils/ambulanceFilters';
import { distanceKm } from '../utils/distance';

const ZONES = ['North', 'West', 'Central', 'East', 'South', 'Old Dhaka'];
const CONTROL = 'w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-action';

export default function AmbulancesPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');
  const locationRequest = useRef(0);
  const lang = i18n.language;
  const category = AMBULANCE_CATEGORIES.includes(params.get('category')) ? params.get('category') : '';
  const area = areas.some(a => a.id === params.get('area')) ? params.get('area') : '';
  const features = params.getAll('feature').filter(f => AMBULANCE_FEATURES.includes(f));
  const query = params.get('q') || '';
  const areaName = id => { const a = areas.find(item => item.id === id); return a ? (lang === 'bn' ? a.bn : a.en) : ''; };

  useEffect(() => {
    let active = true;
    api.get('/ambulances').then(list => { if (active) setVendors(list); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => () => { locationRequest.current += 1; }, []);

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }
  function toggleFeature(feature) {
    const next = new URLSearchParams(params);
    next.delete('feature');
    const selected = features.includes(feature) ? features.filter(f => f !== feature) : [...features, feature];
    selected.forEach(f => next.append('feature', f));
    setParams(next, { replace: true });
  }
  function reset() {
    locationRequest.current += 1;
    setLocating(false);
    setNotice('');
    setParams({}, { replace: true });
  }
  function locate() {
    if (!navigator.geolocation) { setNotice('ambulance_location_unavailable'); return; }
    const request = ++locationRequest.current;
    // Read current URL at completion, preserving filters changed while locating.
    setLocating(true);
    setNotice('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (request !== locationRequest.current) return;
      setLocating(false);
      const position = { lat: coords.latitude, lng: coords.longitude };
      const nearest = areas.map(a => ({ ...a, km: distanceKm(position, a) })).sort((a, b) => a.km - b.km)[0];
      if (nearest.km > 12) { setNotice('ambulance_location_outside'); return; }
      setParams(current => { const next = new URLSearchParams(current); next.set('area', nearest.id); return next; }, { replace: true });
      setNotice('ambulance_location_selected');
    }, err => {
      if (request !== locationRequest.current) return;
      setLocating(false);
      setNotice(err.code === 1 ? 'ambulance_location_denied' : 'ambulance_location_unavailable');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  const visible = filterAmbulances(vendors, { category, area, features, query }, areas);
  return (
    <div>
      <PageHeader title={t('find_ambulance')} />
      <div className="mb-5 grid lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4 items-stretch">
      <div className="bg-primary rounded-2xl overflow-hidden text-white grid md:grid-cols-[3fr_2fr]">
        <div className="p-5 sm:p-7 flex flex-col justify-center">
          <h2 className="font-bold text-lg sm:text-xl">{t('ambulance_intro_title')}</h2>
          <p className="text-sm text-white/80 mt-2 max-w-2xl">{t('ambulance_intro')}</p>
        </div>
        <figure className="relative m-0">
          <img src="/landing/ambulance-dhaka.jpg" alt={t('ambulance_photo_alt')} width="1200" height="900"
            className="w-full h-56 sm:h-64 object-cover object-center" fetchPriority="high" />
          <figcaption className="absolute bottom-0 inset-x-0 px-4 pt-8 pb-3 bg-gradient-to-t from-black/70 to-transparent text-xs text-white">
            {t('ambulance_photo_caption')} · <Link to="/credits" className="underline hover:text-white/80">{t('credits_title')}</Link>
          </figcaption>
        </figure>
      </div>
      <EmergencySection />
      </div>
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
        <aside className="bg-white rounded-2xl border border-gray-100 p-4 h-fit lg:sticky lg:top-[calc(var(--header-h,80px)+16px)] space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><SlidersHorizontal size={17} />{t('ambulance_filters')}</h2><button type="button" onClick={reset} className="text-sm text-primary min-h-11 px-2">{t('clear_all')}</button></div>
          <SearchInput value={query} onChange={q => update('q', q)} placeholder={t('ambulance_search')} />
          <label className="block text-sm font-semibold text-gray-700">{t('ambulance_category')}<select value={category} onChange={e => update('category', e.target.value)} className={`${CONTROL} mt-2`}><option value="">{t('ambulance_all_categories')}</option>{AMBULANCE_CATEGORIES.map(c => <option key={c} value={c}>{t(`ambulance_category_${c}`)}</option>)}</select></label>
          <label className="block text-sm font-semibold text-gray-700">{t('ambulance_pickup_area')}<select value={area} onChange={e => { locationRequest.current += 1; setLocating(false); setNotice(''); update('area', e.target.value); }} className={`${CONTROL} mt-2`}><option value="">{t('ambulance_all_dhaka')}</option>{ZONES.map(zone => <optgroup key={zone} label={t(`ambulance_zone_${zone.replaceAll(' ', '_')}`)}>{areas.filter(a => a.zone === zone).map(a => <option key={a.id} value={a.id}>{areaName(a.id)}</option>)}</optgroup>)}</select></label>
          <button type="button" onClick={locate} disabled={locating} className="flex items-center justify-center gap-2 w-full min-h-11 border border-primary/20 rounded-xl text-sm text-primary disabled:opacity-60"><LocateFixed size={16} />{t(locating ? 'home_map_locating' : 'ambulance_use_location')}</button>
          {notice && <p role="status" className="text-xs text-gray-600">{t(notice)}</p>}
          <fieldset><legend className="text-sm font-semibold text-gray-700 mb-1">{t('ambulance_more_filters')}</legend>{AMBULANCE_FEATURES.map(f => <label key={f} className="flex items-center gap-2 min-h-11 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={features.includes(f)} onChange={() => toggleFeature(f)} className="h-4 w-4 accent-primary" />{t(`ambulance_feature_${f}`)}</label>)}</fieldset>
        </aside>
        <section aria-label={t('ambulance_results')} className="min-w-0">
          <div className="bg-primary/5 rounded-xl px-4 py-3 mb-4 text-sm text-primary"><p className="font-semibold">{t('ambulance_booking_title')}</p><p className="mt-1">{t('ambulance_booking_note')}</p></div>
          <p className="text-xs text-gray-500 mb-4">{t('ambulance_pricing_preview_note')}</p>
          {category === 'freezer' && <p className="bg-amber-50 border border-amber-100 text-amber-900 rounded-xl p-3 text-sm mb-4">{t('ambulance_freezer_note')}</p>}
          {area && <p className="text-xs text-gray-500 mb-4">{t('ambulance_distance_note', { area: areaName(area) })}</p>}
          {loading ? <p role="status" className="py-16 text-center text-gray-500">{t('loading')}</p> : error ? (
            <EmptyState title={t('ambulance_load_error')} message={t('ambulance_retry_note')} actions={[{ label: t('retry'), onClick: () => { setLoading(true); setError(false); setReload(n => n + 1); } }]} />
          ) : <>
            <p role="status" className="text-sm text-gray-500 mb-3">{t('ambulance_results_count', { count: visible.length })}</p>
            {visible.length === 0 ? <EmptyState title={t('ambulance_empty')} message={t('ambulance_empty_note')} actions={[{ label: t('clear_search_filters'), onClick: reset }]} /> : <ul className="grid md:grid-cols-2 gap-4">{visible.map(vendor => <AmbulanceVendorCard key={vendor.id} vendor={vendor} areaName={areaName} lang={lang} />)}</ul>}
          </>}
        </section>
      </div>
    </div>
  );
}
