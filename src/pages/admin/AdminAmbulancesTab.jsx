import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ambulance, Pencil, Plus, Search, X } from 'lucide-react';
import { api } from '../../api/client';
import areas from '../../data/dhakaAreas.json';
import { AMBULANCE_CATEGORIES, AMBULANCE_FEATURES } from '../../utils/ambulanceFilters';
import AdminRecordActions from './AdminRecordActions';

const INPUT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white';

const BLANK = {
  name: '', name_bn: '', address: '', address_bn: '', phones: '', base_area: '', dhaka_wide: false,
  service_areas: [], categories: [], features: [], fares: {}, source_url: '', source_checked_on: '',
};

const toForm = v => ({ ...v, phones: (v.phones || []).join(', '), source_checked_on: v.source_checked_on ?? '', source_url: v.source_url ?? '' });
const toggle = (list, item) => (list.includes(item) ? list.filter(i => i !== item) : [...list, item]);

function Field({ label, children, wide }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Chip({ checked, onChange, children }) {
  return (
    <label className={`flex items-center gap-2 text-sm rounded-lg border px-2.5 py-1.5 cursor-pointer select-none
      ${checked ? 'border-primary bg-primary/5 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-primary" />
      {children}
    </label>
  );
}

function VendorForm({ form, setForm, sampleFares, onSave, onCancel, error, saving, actions }) {
  const { t } = useTranslation();
  const [areaQuery, setAreaQuery] = useState('');
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const visibleAreas = areas.filter(a => a.en.toLowerCase().includes(areaQuery.toLowerCase()));
  const setFare = (category, key, value) =>
    setForm(f => ({ ...f, fares: { ...f.fares, [category]: { ...f.fares?.[category], [key]: value } } }));

  return (
    <form onSubmit={onSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {actions}
      <Field label="Name"><input required value={form.name} onChange={e => set({ name: e.target.value })} className={INPUT} /></Field>
      <Field label="Name in Bangla"><input value={form.name_bn ?? ''} onChange={e => set({ name_bn: e.target.value })} className={INPUT} /></Field>
      <Field label="Address"><input value={form.address ?? ''} onChange={e => set({ address: e.target.value })} className={INPUT} /></Field>
      <Field label="Address in Bangla"><input value={form.address_bn ?? ''} onChange={e => set({ address_bn: e.target.value })} className={INPUT} /></Field>
      <Field label="Phone numbers (first one is the main booking line; separate with commas)" wide>
        <input required value={form.phones} onChange={e => set({ phones: e.target.value })} placeholder="01714325325, 01993800900" className={INPUT} />
      </Field>

      <fieldset className="sm:col-span-2 border-t border-gray-100 pt-3">
        <legend className="text-sm font-semibold text-gray-800">Ambulance types and fares</legend>
        <p className="text-xs text-gray-500 mt-0.5">Fares are one way within Dhaka, in taka. Leave a fare empty to show the shared sample range, labelled as sample.</p>
        <div className="mt-3 flex flex-col gap-2">
          {AMBULANCE_CATEGORIES.map(category => {
            const on = form.categories.includes(category);
            const sample = sampleFares?.[category];
            return (
              <div key={category} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_1fr] gap-2 items-center">
                <Chip checked={on} onChange={() => set({ categories: toggle(form.categories, category) })}>{t(`ambulance_category_${category}`)}</Chip>
                {on && ['min', 'max'].map(key => (
                  <input key={key} type="number" min="0" step="1" inputMode="numeric" value={form.fares?.[category]?.[key] ?? ''}
                    onChange={e => setFare(category, key, e.target.value)} aria-label={`${category} ${key === 'min' ? 'lowest' : 'highest'} fare`}
                    placeholder={sample ? `${key === 'min' ? 'From' : 'To'} (sample ${sample[key]})` : key === 'min' ? 'From' : 'To'} className={INPUT} />
                ))}
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="sm:col-span-2 border-t border-gray-100 pt-3">
        <legend className="text-sm font-semibold text-gray-800">Services</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {AMBULANCE_FEATURES.map(feature => (
            <Chip key={feature} checked={form.features.includes(feature)} onChange={() => set({ features: toggle(form.features, feature) })}>
              {t(`ambulance_feature_${feature}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="sm:col-span-2 border-t border-gray-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <legend className="text-sm font-semibold text-gray-800">Coverage</legend>
        <Field label="Base area (used for distance from the patient)">
          <select value={form.base_area ?? ''} onChange={e => set({ base_area: e.target.value })} className={INPUT}>
            <option value="">No base area</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.en}</option>)}
          </select>
        </Field>
        <div className="flex items-end">
          <Chip checked={form.dhaka_wide} onChange={() => set({ dhaka_wide: !form.dhaka_wide })}>Serves all of Dhaka</Chip>
        </div>
        {!form.dhaka_wide && (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-gray-500 mb-1">Areas served ({form.service_areas.length} selected)</p>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2">
              <Search size={13} className="text-gray-400" />
              <input value={areaQuery} onChange={e => setAreaQuery(e.target.value)} placeholder="Search areas" className="flex-1 text-xs outline-none bg-transparent" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {visibleAreas.map(a => (
                <label key={a.id} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.service_areas.includes(a.id)} className="accent-primary"
                    onChange={() => set({ service_areas: toggle(form.service_areas, a.id) })} />
                  {a.en}
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      <Field label="Source link"><input type="url" value={form.source_url} onChange={e => set({ source_url: e.target.value })} placeholder="https://…" className={INPUT} /></Field>
      <Field label="Checked on"><input type="date" value={form.source_checked_on} onChange={e => set({ source_checked_on: e.target.value })} className={INPUT} /></Field>

      {error && <p role="alert" className="sm:col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2 mt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-primary text-white min-h-11 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 min-h-11 py-2 rounded-lg text-sm bg-white">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminAmbulancesTab() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState([]);
  const [sampleFares, setSampleFares] = useState({});
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function reload() { api.get('/admin/ambulances').then(setVendors); }
  useEffect(() => {
    reload();
    api.get('/admin/sample-prices').then(s => setSampleFares(s.ambulanceFares));
  }, []);

  const visible = useMemo(() => vendors.filter(v =>
    !search || [v.name, v.name_bn, ...(v.phones || [])].some(x => x?.toLowerCase().includes(search.toLowerCase()))), [vendors, search]);

  function open(vendor) { setError(''); setForm(vendor ? toForm(vendor) : BLANK); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (form.id) await api.patch(`/admin/ambulances/${form.id}`, form);
      else await api.post('/admin/ambulances', form);
      setForm(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-800">Ambulances <span className="text-gray-400 font-normal text-base">({visible.length})</span></h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white w-64">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone" className="flex-1 text-sm outline-none bg-transparent" />
          </div>
          <button onClick={() => open(null)} className="flex items-center gap-1 text-sm font-medium text-primary border border-primary rounded-lg px-3 py-2 bg-white whitespace-nowrap">
            <Plus size={14} /> Add vendor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map(v => (
          <div key={v.id} onClick={() => open(v)}
            className={`${v.hidden ? 'opacity-60' : ''} bg-white rounded-xl shadow-sm p-3 flex justify-between items-center text-sm cursor-pointer hover:shadow-md hover:bg-gray-50 transition-shadow`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-primary/5 text-primary flex items-center justify-center flex-shrink-0"><Ambulance size={16} /></span>
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">{v.name}{v.hidden && <span className="ml-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">Hidden</span>}</p>
                <p className="text-xs text-gray-500 truncate">{v.categories.map(c => t(`ambulance_category_${c}`)).join(' · ')}</p>
                <p className="text-xs text-primary">{Object.keys(v.fares || {}).length ? 'Own fares' : 'Sample fares'} · {v.phones[0]}</p>
              </div>
            </div>
            <Pencil size={16} className="text-gray-400 flex-shrink-0 ml-2" />
          </div>
        ))}
      </div>
      {visible.length === 0 && <div className="text-center py-16 text-gray-400 text-sm">No ambulance vendors match.</div>}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-scrim" onClick={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="glass-panel rounded-2xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-base">{form.id ? 'Edit ambulance vendor' : 'Add ambulance vendor'}</h3>
              <button onClick={() => setForm(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <VendorForm form={form} setForm={setForm} sampleFares={sampleFares} onSave={handleSave} onCancel={() => setForm(null)}
              error={error} saving={saving}
              actions={form.id && <AdminRecordActions path={`/admin/ambulances/${form.id}`} hidden={form.hidden} label="vendor"
                onHiddenChange={hidden => { setForm(f => ({ ...f, hidden })); reload(); }}
                onDeleted={() => { setForm(null); reload(); }} />} />
          </div>
        </div>
      )}
    </div>
  );
}
