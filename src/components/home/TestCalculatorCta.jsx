import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Calculator, Check, FlaskConical, LocateFixed } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import { citiesForDivisions } from '../../utils/geo';
import { districtAtLocation } from '../../utils/locationDistrict';
import { api } from '../../api/client';

export default function TestCalculatorCta() {
  const { t, i18n } = useTranslation();
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('');
  const [centreSearch, setCentreSearch] = useState('');
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);
  const [picked, setPicked] = useState(new Set());
  useEffect(() => {
    let active = true;
    api.get('/hospitals').then(list => { if (active) setCentres(list.filter(c => c.type === 'diagnostic' && c.tests?.some(test => test.price != null))); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const collator = new Intl.Collator(i18n.language, { sensitivity: 'base', numeric: true });
  const byName = (a, b) => collator.compare(a.name, b.name);
  const districts = citiesForDivisions([]).sort(collator.compare);
  const available = centres.filter(c => !district || c.location === district).sort(byName);
  const matches = available.filter(c => c.name.toLowerCase().includes(centreSearch.trim().toLowerCase()));
  const centre = available.find(c => String(c.id) === centreId) || available[0];
  function chooseDistrict(value) { locationRequest.current += 1; setLocating(false); setNotice(''); setDistrict(value); setCentreId(''); setCentreSearch(''); setPicked(new Set()); }
  async function locate() {
    if (!navigator.geolocation) { setNotice(t('home_map_unavailable')); return; }
    const request = ++locationRequest.current;
    setLocating(true); setNotice('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const { default: geo } = await import('../../data/bdDistricts.json');
        if (request !== locationRequest.current) return;
        const found = districtAtLocation(geo, { lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
        if (!found) { setNotice(t('home_map_outside')); return; }
        const name = found.name === 'Cumilla' ? 'Comilla' : found.name;
        setDistrict(name); setCentreId(''); setCentreSearch(''); setPicked(new Set());
        setNotice(t('home_calc_location_selected', { district: name }));
      } catch { if (request === locationRequest.current) { setLocating(false); setNotice(t('home_map_unavailable')); } }
    }, error => { if (request !== locationRequest.current) return; setLocating(false); setNotice(t(error.code === 1 ? 'home_map_denied' : 'home_map_unavailable')); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  const allTests = (centre?.tests || []).filter(test => test.price != null).sort(byName);
  const q = query.trim().toLowerCase();
  const tests = q ? allTests.filter(test => test.name.toLowerCase().includes(q)) : allTests.slice(0, 4);
  const chosen = allTests.filter(test => picked.has(test.name));
  const money = value => `৳${value.toLocaleString(i18n.language === 'bn' ? 'bn-BD' : 'en-BD')}`;
  function toggle(name) {
    setPicked(current => { const next = new Set(current); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  }
  const params = new URLSearchParams();
  chosen.forEach(test => params.append('test', test.name));
  const destination = centre ? `/diagnostic-centres/${centre.id}?${params}#test-prices` : '/diagnostic-centres';
  return <section className="overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-white to-sky-50 p-5 sm:p-8 grid lg:grid-cols-2 gap-6 lg:gap-12 items-center" aria-labelledby="calculator-cta-title">
    <div>
      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary"><FlaskConical size={15} />{t('home_calc_badge')}</span>
      <h2 id="calculator-cta-title" className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900">{t('home_calc_title')}</h2>
      <p className="mt-3 text-gray-600 leading-relaxed">{t('home_calc_desc')}</p>
      <Link to={destination} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><Calculator size={19} />{t('home_calc_cta')}<ArrowRight size={18} /></Link>
    </div>
    <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-lg shadow-primary/5 border border-gray-100">
      <p className="text-sm font-semibold text-gray-900">{t('home_calc_try')}</p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
        <label className="text-xs font-medium text-gray-600">{t('home_calc_district')}
          <select value={district} onChange={event => chooseDistrict(event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 p-3 text-sm">
            <option value="">{t('home_calc_all_districts')}</option>{districts.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" onClick={locate} disabled={locating} className="flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 px-3 text-sm text-primary disabled:opacity-60"><LocateFixed size={16} />{t(locating ? 'home_map_locating' : 'home_calc_near_me')}</button>
      </div>
      {notice && <p role="status" className="mt-2 text-xs text-gray-600">{notice}</p>}
      <SearchInput value={centreSearch} onChange={setCentreSearch} placeholder={t('home_calc_search_centres')} className="mt-3" />
      <label className="block mt-2 text-xs font-medium text-gray-600">{t('diagnostic_centres')}
        <select value={matches.some(c => c.id === centre?.id) ? String(centre.id) : ''} onChange={event => { setCentreId(event.target.value); setPicked(new Set()); }} disabled={!matches.length} className="mt-1 block w-full rounded-xl border border-gray-200 p-3 text-sm font-normal disabled:opacity-60">
          <option value="" disabled>{t(matches.length ? 'home_calc_choose_centre' : 'home_calc_no_centres')}</option>
          {matches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <SearchInput value={query} onChange={setQuery} placeholder={t('search_tests')} className="mt-3" />
      <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
        {tests.map(test => <button type="button" key={test.name} aria-pressed={picked.has(test.name)} onClick={() => toggle(test.name)} className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${picked.has(test.name) ? 'bg-primary/5 border-primary/30' : 'border-gray-100 hover:border-primary/30'}`}>
          <span aria-hidden="true" className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${picked.has(test.name) ? 'bg-primary text-white border-primary' : 'border-gray-300'}`}>{picked.has(test.name) && <Check size={14} />}</span>
          <span className="flex-1 text-sm text-gray-700">{test.name}</span><span className="font-semibold text-sm text-primary">{money(test.price)}</span>
        </button>)}
        {!tests.length && <p className="py-4 text-sm text-gray-500">{t(q && centre ? 'no_tests_match' : 'home_calc_fallback')}</p>}
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4 flex items-center justify-between gap-3" aria-live="polite" aria-atomic="true"><span className="text-sm text-gray-600">{t('test_price_subtotal')} · {t('home_calc_selected', { count: chosen.length })}</span><span className="text-2xl font-bold text-primary tabular-nums">{money(chosen.reduce((sum, test) => sum + test.price, 0))}</span></div>
      <p className="mt-3 text-xs text-gray-500">{t('test_prices_note')}</p>
    </div>
  </section>;
}
