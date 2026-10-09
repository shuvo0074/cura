import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Calculator, Check, FlaskConical } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import { api } from '../../api/client';

export default function TestCalculatorCta() {
  const { t, i18n } = useTranslation();
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(new Set());
  useEffect(() => {
    let active = true;
    api.get('/hospitals').then(list => { if (active) setCentres(list.filter(c => c.type === 'diagnostic' && c.tests?.some(test => test.price != null))); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const centre = centres.find(c => String(c.id) === centreId) || centres[0];
  const allTests = (centre?.tests || []).filter(test => test.price != null);
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
      <label className="text-sm font-semibold text-gray-900">{t('home_calc_try')}
        {centre && <select value={String(centre.id)} onChange={event => { setCentreId(event.target.value); setPicked(new Set()); }} className="mt-3 block w-full rounded-xl border border-gray-200 p-3 text-sm font-normal">
          {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>}
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
