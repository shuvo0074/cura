import { useTranslation } from 'react-i18next';
import { BedDouble, House, Info, ReceiptText, Stethoscope } from 'lucide-react';
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

// Indicative prices for common tests and scans, grouped by kind. Patients in
// Bangladesh compare these between places before choosing where to go.
export function TestPricesSection({ hospital, id }) {
  const { t, i18n } = useTranslation();
  const tests = hospital.tests || [];
  if (!tests.length) return null;

  const money = new Intl.NumberFormat(i18n.language === 'bn' ? 'bn-BD' : 'en-IN');
  const homeSample = (hospital.services || []).some(s => s.key === 'home_sample');
  const groups = TEST_CATEGORIES
    .map(cat => ({ cat, items: tests.filter(x => x.category === cat) }))
    .filter(g => g.items.length);

  return (
    <section id={id} className={`${CARD} p-5 sm:p-6 scroll-mt-[calc(var(--header-h)+1rem)]`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <ReceiptText size={18} className="text-primary" /> {t('test_prices')}
      </h2>
      <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
        <Info size={12} className="flex-shrink-0" /> {t('test_prices_note')}
      </p>
      {homeSample && (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/5 rounded-full px-3 py-1.5 mt-3">
          <House size={13} /> {t('home_sample_available')}
        </p>
      )}

      {groups.map(g => (
        <div key={g.cat} className="mt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t(`test_cat_${g.cat}`)}</h3>
          <ul className="divide-y divide-gray-100">
            {g.items.map(x => (
              <li key={x.name} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <span className="text-gray-800">{x.name}</span>
                <span className="flex-shrink-0 font-semibold text-gray-900 tabular-nums">৳{money.format(x.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
