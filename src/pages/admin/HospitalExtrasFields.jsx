import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { FACILITY_ICONS, SERVICE_GROUPS, TEST_CATEGORIES, is24x7 } from '../../components/hospital/hospitalCatalogue';

const TYPES = ['hospital', 'diagnostic', 'clinic', 'online'];
const PAYMENTS = ['cash', 'bkash', 'nagad', 'card', 'insurance'];
const COMMON_TESTS = [
  'Complete Blood Count (CBC)', 'Random Blood Sugar (RBS)', 'HbA1c', 'Lipid Profile', 'Thyroid (TSH)',
  'Serum Creatinine', 'Urine Routine Examination', 'Dengue NS1 Antigen', 'X-ray Chest (PA view)',
  'Ultrasound Whole Abdomen', 'CT Scan Brain', 'MRI Brain', 'ECG', 'Echocardiogram',
];

const INPUT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white';

function Section({ title, hint, children }) {
  return (
    <fieldset className="sm:col-span-2 border-t border-gray-100 pt-4 mt-1">
      <legend className="text-sm font-semibold text-gray-800">{title}</legend>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className={`flex items-center gap-2 text-sm rounded-lg border px-2.5 py-1.5 cursor-pointer select-none transition-colors
      ${checked ? 'border-primary bg-primary/5 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-primary" />
      {children}
    </label>
  );
}

// Hours field with a "24/7" shortcut; stores '24/7' or free text.
function HoursInput({ value, onChange, placeholder }) {
  const allDay = is24x7(value);
  return (
    <div className="flex items-center gap-2">
      <input value={allDay ? '' : value ?? ''} disabled={allDay} onChange={e => onChange(e.target.value)}
        placeholder={allDay ? 'Open 24/7' : placeholder} className={`${INPUT} flex-1 min-w-0 disabled:bg-gray-50`} />
      <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
        <input type="checkbox" checked={allDay} onChange={e => onChange(e.target.checked ? '24/7' : '')} className="accent-primary" /> 24/7
      </label>
    </div>
  );
}

// Admin fields for what a hospital offers beyond doctors' chambers (see
// schema.sql): type, hours, beds, services with their hours, facilities,
// payment methods and the test price list. Works on the same form object as
// the basic fields, using the API's column names.
export default function HospitalExtrasFields({ form, setForm }) {
  const { t } = useTranslation();
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const services = form.services || [];
  const offered = new Map(services.map(s => [s.key, s]));
  const tests = form.tests || [];
  const beds = form.beds || {};

  function toggleService(key) {
    set({ services: offered.has(key) ? services.filter(s => s.key !== key) : [...services, { key, hours: '' }] });
  }
  function serviceHours(key, hours) {
    set({ services: services.map(s => (s.key === key ? { ...s, hours } : s)) });
  }
  function toggleIn(field, key) {
    const list = form[field] || [];
    set({ [field]: list.includes(key) ? list.filter(k => k !== key) : [...list, key] });
  }
  function setTest(i, patch) {
    set({ tests: tests.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  }

  return (
    <>
      <Section title="Type & hours">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">Type</span>
            <select value={form.type ?? ''} onChange={e => set({ type: e.target.value || null })} className={INPUT}>
              <option value="">Not set</option>
              {TYPES.map(k => <option key={k} value={k}>{t(`htype_${k}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">Opening hours</span>
            <HoursInput value={form.opening_hours} onChange={v => set({ opening_hours: v })} placeholder="Sat – Thu, 9:00 AM – 10:00 PM" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-gray-500">Visiting hours (inpatients)</span>
            <input value={form.visiting_hours ?? ''} onChange={e => set({ visiting_hours: e.target.value })}
              placeholder="11:00 AM – 1:00 PM, 5:00 PM – 7:00 PM" className={INPUT} />
          </label>
        </div>
      </Section>

      <Section title="Beds" hint="Leave empty for outpatient-only places.">
        <div className="grid grid-cols-3 gap-3">
          {[['general', 'General'], ['cabin', 'Cabins'], ['icu', 'ICU']].map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <input type="number" min="0" step="1" inputMode="numeric" value={beds[key] ?? ''}
                onChange={e => set({ beds: { ...beds, [key]: e.target.value === '' ? null : Number(e.target.value) } })}
                className={INPUT} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Services" hint="Tick what's offered here, then add its hours.">
        <div className="flex flex-col gap-4">
          {SERVICE_GROUPS.map(g => (
            <div key={g.key}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t(`svc_group_${g.key}`)}</p>
              <div className="flex flex-col gap-2">
                {g.services.map(key => {
                  const on = offered.has(key);
                  return (
                    <div key={key} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 items-center">
                      <Toggle checked={on} onChange={() => toggleService(key)}>{t(`svc_${key}`)}</Toggle>
                      {on && <HoursInput value={offered.get(key).hours} onChange={v => serviceHours(key, v)} placeholder="8:00 AM – 10:00 PM" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Facilities & payment">
        <p className="text-xs font-medium text-gray-500 mb-2">Facilities</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(FACILITY_ICONS).map(key => (
            <Toggle key={key} checked={(form.facilities || []).includes(key)} onChange={() => toggleIn('facilities', key)}>{t(`fac_${key}`)}</Toggle>
          ))}
        </div>
        <p className="text-xs font-medium text-gray-500 mt-4 mb-2">Payment methods</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENTS.map(key => (
            <Toggle key={key} checked={(form.payment_methods || []).includes(key)} onChange={() => toggleIn('payment_methods', key)}>{t(`pay_${key}`)}</Toggle>
          ))}
        </div>
      </Section>

      <Section title="Test prices" hint={'Indicative prices in taka. Leave the price empty to show "Call for price". Rows without a name are ignored.'}>
        <datalist id="common-tests">
          {COMMON_TESTS.map(n => <option key={n} value={n} />)}
        </datalist>
        <div className="flex flex-col gap-2">
          {tests.length > 0 && (
            <div className="hidden sm:grid grid-cols-[1fr_140px_110px_36px] gap-2 text-xs font-medium text-gray-500">
              <span>Test</span><span>Category</span><span>Price (৳)</span><span />
            </div>
          )}
          {tests.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_36px] sm:grid-cols-[1fr_140px_110px_36px] gap-2 items-center">
              <input list="common-tests" value={x.name} onChange={e => setTest(i, { name: e.target.value })} placeholder="Test name"
                aria-label="Test name" className={`${INPUT} min-w-0 col-span-2 sm:col-span-1`} />
              <button type="button" onClick={() => set({ tests: tests.filter((_, j) => j !== i) })} aria-label={`Remove ${x.name || 'test'}`}
                className="sm:order-last w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                <Trash2 size={16} />
              </button>
              <select value={x.category} onChange={e => setTest(i, { category: e.target.value })} aria-label="Category" className={INPUT}>
                {TEST_CATEGORIES.map(c => <option key={c} value={c}>{t(`test_cat_${c}`)}</option>)}
              </select>
              <input type="number" min="0" step="1" inputMode="numeric" value={x.price ?? ''}
                onChange={e => setTest(i, { price: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="0" aria-label="Price in taka" className={INPUT} />
            </div>
          ))}
          <button type="button" onClick={() => set({ tests: [...tests, { name: '', category: 'blood', price: '' }] })}
            className="self-start flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5">
            <Plus size={14} /> Add test
          </button>
        </div>
      </Section>
    </>
  );
}
