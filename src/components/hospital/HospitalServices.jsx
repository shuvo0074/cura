import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble, Calculator, House, Info, ReceiptText, Search, Stethoscope, X } from 'lucide-react';
import { FACILITY_ICONS, SERVICE_GROUPS, SERVICE_ICONS, TEST_CATEGORIES, is24x7 } from './hospitalCatalogue';

const CARD = 'bg-white rounded-xl border border-gray-100 shadow-sm';

function Hours({ hours }) {
  const { t } = useTranslation();
  if (!hours) return null;
  return is24x7(hours)
    ? <span className="block text-xs font-semibold text-green-700">{t('open_24_7')}</span>
    : <span className="block text-[11px] sm:text-xs text-gray-500 whitespace-nowrap">{hours}</span>;
}

// What the hospital offers beyond doctors' chambers: services grouped by why
// you'd come (emergency, a test or scan, ongoing care), each with its hours;
// bed counts for inpatient places; and on-site facilities.
export function ServicesSection({ hospital, id }) {
  const { t } = useTranslation();
  const offered = new Map((hospital.services || []).map(s => [s.key, s]));
  const groups = SERVICE_GROUPS
    .map(g => ({ ...g, items: g.services.filter(k => offered.has(k) && SERVICE_ICONS[k]).map(k => offered.get(k)) }))
    .filter(g => g.items.length);
  const facilities = (hospital.facilities || []).filter(k => FACILITY_ICONS[k]);
  const beds = hospital.beds;

  if (!groups.length && !facilities.length && !beds) return null;

  return (
    <section id={id} className={`${CARD} p-5 sm:p-6 scroll-mt-[calc(var(--header-h)+1rem)]`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <Stethoscope size={18} className="text-primary" /> {t('services_facilities')}
      </h2>

      {beds && (
        <dl className="grid grid-cols-3 mt-4 rounded-xl bg-gray-50 text-center">
          {[['beds_general', beds.general], ['beds_cabin', beds.cabin], ['beds_icu', beds.icu]].map(([key, n]) => (
            <div key={key} className="py-3 px-2">
              <dt className="flex items-center justify-center gap-1 text-xs text-gray-500"><BedDouble size={12} /> {t(key)}</dt>
              <dd className="text-base font-bold text-gray-900 mt-0.5">{n ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      {groups.map(g => (
        <div key={g.key} className="mt-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t(`svc_group_${g.key}`)}</h3>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {g.items.map(s => {
              const Icon = SERVICE_ICONS[s.key];
              const urgent = s.key === 'emergency';
              return (
                <li key={s.key} className={`flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2.5 rounded-xl border px-3 py-2.5 sm:px-2.5 sm:py-2 ${urgent ? 'border-red-200 bg-red-50/60' : 'border-gray-100'}`}>
                  <span className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${urgent ? 'bg-red-600 text-white' : 'bg-primary/10 text-primary'}`} aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] sm:text-sm font-medium text-gray-900 leading-snug">{t(`svc_${s.key}`)}</p>
                    <Hours hours={s.hours} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {facilities.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('facilities')}</h3>
          <ul className="flex flex-wrap gap-2">
            {facilities.map(k => {
              const Icon = FACILITY_ICONS[k];
              return (
                <li key={k} className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 rounded-full px-3 py-1.5">
                  <Icon size={13} className="text-gray-500" /> {t(`fac_${k}`)}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// Indicative prices for common tests and scans, grouped by kind, doubling as
// a calculator: patients tick the tests on their prescription and see the
// estimated total before they go. Patients in Bangladesh compare these
// between places before choosing where to have tests done.
export function TestPricesSection({ hospital, id }) {
  const { t, i18n } = useTranslation();
  const [picked, setPicked] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const tests = hospital.tests || [];
  if (!tests.length) return null;

  const money = new Intl.NumberFormat(i18n.language === 'bn' ? 'bn-BD' : 'en-IN');
  const homeSample = (hospital.services || []).some(s => s.key === 'home_sample');
  // Search narrows the list; ticked tests still count towards the total.
  const q = query.trim().toLowerCase();
  const groups = TEST_CATEGORIES
    .map(cat => ({ cat, items: tests.filter(x => x.category === cat && (!q || x.name.toLowerCase().includes(q))) }))
    .filter(g => g.items.length);
  const chosen = tests.filter(x => picked.has(x.name));
  // Unpublished prices are excluded from the subtotal, never counted as zero.
  const priced = chosen.filter(x => x.price != null);
  const unpriced = chosen.length - priced.length;
  const total = priced.reduce((sum, x) => sum + x.price, 0);
  const anyPrices = tests.some(x => x.price != null);
  const hasPublished = tests.some(x => x.source_url && x.price != null);
  const hasDemo = tests.some(x => x.price_kind === 'demo');
  const chosenDemo = chosen.some(x => x.price_kind === 'demo');

  function toggle(name) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  return (
    <section id={id} className={`${CARD} p-5 sm:p-6 scroll-mt-[calc(var(--header-h)+1rem)]`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <ReceiptText size={18} className="text-primary" /> {t('test_prices')}
      </h2>
      <p className="text-sm text-gray-600 mt-1">{t(anyPrices ? 'test_calc_hint' : 'test_calc_hint_no_prices')}</p>
      {(!hasDemo || hasPublished) && <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
        <Info size={12} className="flex-shrink-0" /> {t(hasPublished ? 'test_prices_published_note' : anyPrices ? 'test_prices_note' : 'test_prices_unpublished')}
      </p>}
      {hasDemo && <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-3">{t('test_prices_demo_note')}</p>}
      {homeSample && (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/5 rounded-full px-3 py-1.5 mt-3">
          <House size={13} /> {t('home_sample_available')}
        </p>
      )}

      <label className="field mt-4 flex items-center gap-2 border border-gray-200 rounded-xl px-3 h-11 cursor-text">
        <Search size={16} className="text-gray-400 flex-shrink-0" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search_tests')} aria-label={t('search_tests')}
          className="flex-1 min-w-0 text-sm outline-none bg-transparent" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('clear_search')} className="text-gray-400 p-1 -m-1"><X size={16} /></button>
        )}
      </label>
      {groups.length === 0 && <p className="text-sm text-gray-500 text-center py-6">{t('no_tests_match')}</p>}

      {groups.map(g => (
        <div key={g.cat} className="mt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t(`test_cat_${g.cat}`)}</h3>
          <ul className="divide-y divide-gray-100">
            {g.items.map(x => {
              const on = picked.has(x.name);
              return (
                <li key={x.name}>
                  <label className={`flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg text-sm cursor-pointer select-none transition-colors ${on ? 'bg-primary/5' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(x.name)} className="accent-primary w-4 h-4 flex-shrink-0" />
                    <span className={`flex-1 ${on ? 'text-gray-900 font-medium' : 'text-gray-800'}`}>{x.name}
                      {x.source_url && <a href={x.source_url} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()} className="block text-[11px] text-primary underline mt-1">
                        {t('test_price_source', { date: new Date(`${x.source_checked_on}T00:00:00`).toLocaleDateString(i18n.language === 'bn' ? 'bn-BD' : 'en-GB') })}
                      </a>}
                    </span>
                    {x.price != null
                      ? <span className="flex-shrink-0 font-semibold text-gray-900 tabular-nums text-right">৳{money.format(x.price)}
                        {x.price_kind === 'demo' && <span className="block text-[11px] font-medium text-amber-700">{t('demo_price')}</span>}
                      </span>
                      : <span className="flex-shrink-0 text-xs font-medium text-gray-500">{t('price_not_published')}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Running total; once tests are ticked it stays pinned to the bottom of the screen. */}
      <div aria-live="polite"
        className={`mt-4 flex items-center gap-3 rounded-xl px-4 py-3 transition-colors
          ${chosen.length ? 'sticky bottom-3 shadow-lg bg-primary text-white' : 'bg-gray-50 text-gray-500'}`}>
        <Calculator size={18} className="flex-shrink-0" />
        {chosen.length ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80">{t('tests_selected', { count: chosen.length })}</p>
              {priced.length > 0 && <><p className="text-xs text-white/80">{t(chosenDemo ? 'test_price_demo_subtotal' : 'test_price_subtotal')}</p><p className="text-lg font-bold leading-tight tabular-nums">৳{money.format(total)}</p></>}
              {unpriced > 0 && (
                <p className={priced.length ? 'text-xs text-white/80' : 'text-sm font-semibold'}>
                  {priced.length ? t('n_prices_unpublished', { count: unpriced }) : t('test_prices_all_unpublished')}
                </p>
              )}
            </div>
            <button type="button" onClick={() => setPicked(new Set())}
              className="flex-shrink-0 text-sm font-medium rounded-lg px-3 py-1.5 bg-white/15 hover:bg-white/25">
              {t('clear')}
            </button>
          </>
        ) : (
          <p className="text-sm">{t('test_calc_empty')}</p>
        )}
      </div>
    </section>
  );
}
