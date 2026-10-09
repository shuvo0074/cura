import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Stethoscope, X } from 'lucide-react';
import { api } from '../../api/client';
import AdminPhotoField from './AdminPhotoField';
import AdminRecordActions from './AdminRecordActions';

const INPUT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white';

// Specialties and symptoms share this tab: the page cards patients browse
// (name in English and Bangla, description, tags, image), plus a specialty's
// icon and the specialties a symptom sends patients to.
const KINDS = {
  specialties: { title: 'Specialties', one: 'specialty', path: '/specialties' },
  symptoms: { title: 'Symptoms', one: 'symptom', path: '/symptoms' },
};

const BLANK = { name: '', name_bn: '', icon: '', description: '', tags: '', image: '', specialties: [] };
const toForm = item => ({ ...BLANK, ...item, tags: (item.tags || []).join(', '), image: item.image ?? '' });
const toBody = form => ({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) });

function Field({ label, hint, wide, children }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

function SpecialtyPicker({ names, selected, onChange }) {
  const [q, setQ] = useState('');
  const visible = names.filter(n => n.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="sm:col-span-2">
      <p className="text-xs font-medium text-gray-500">Specialists for this symptom ({selected.length} selected)</p>
      <p className="text-xs text-gray-400 mb-1.5">Doctors with these specialties are listed for the symptom, as well as any whose profile mentions it.</p>
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2">
        <Search size={13} className="text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search specialties" className="flex-1 text-xs outline-none bg-transparent" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
        {visible.map(name => (
          <label key={name} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" className="accent-primary" checked={selected.includes(name)}
              onChange={() => onChange(selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name])} />
            {name}
          </label>
        ))}
      </div>
    </div>
  );
}

function CatalogForm({ kind, form, setForm, specialtyNames, pendingImage, setPendingImage, onSave, onCancel, error, saving, actions }) {
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const uploaded = form.image?.startsWith('/');
  return (
    <form onSubmit={onSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {actions}
      <div className="sm:col-span-2 pb-3 border-b border-gray-100 flex flex-col gap-2">
        <AdminPhotoField photo={form.image} uploadPath={form.id ? `/admin/${kind}/${form.id}/photo` : null} rounded="rounded-lg"
          pendingFile={pendingImage} onPendingFile={setPendingImage} onPhoto={image => set({ image: image ?? '' })}
          placeholder={<Stethoscope size={26} className="text-gray-300" />} />
        {!uploaded && !pendingImage && (
          <input type="url" value={form.image} onChange={e => set({ image: e.target.value })} placeholder="…or paste an image link (https://…)"
            aria-label="Image link" className={`${INPUT} text-xs`} />
        )}
      </div>
      <Field label="Name"><input required value={form.name} onChange={e => set({ name: e.target.value })} className={INPUT} /></Field>
      <Field label="Name in Bangla"><input value={form.name_bn ?? ''} onChange={e => set({ name_bn: e.target.value })} className={INPUT} /></Field>
      {kind === 'specialties' && (
        <Field label="Icon (an emoji)"><input value={form.icon ?? ''} onChange={e => set({ icon: e.target.value })} maxLength={8} className={`${INPUT} w-24`} /></Field>
      )}
      <Field label="Tags (separate with commas, up to 6)" wide={kind !== 'specialties'}>
        <input value={form.tags} onChange={e => set({ tags: e.target.value })} placeholder="Heart Check-up, ECG & Echo" className={INPUT} />
      </Field>
      <Field label="Description" wide
        hint={kind === 'specialties' ? "Shown on the card, about three lines. Also helps search: words here find this specialty's doctors." : 'Shown on the card, about three lines.'}>
        <textarea rows={3} maxLength={500} value={form.description ?? ''} onChange={e => set({ description: e.target.value })} className={`${INPUT} resize-none`} />
      </Field>
      {kind === 'symptoms' && <SpecialtyPicker names={specialtyNames} selected={form.specialties} onChange={specialties => set({ specialties })} />}
      {form.id && form.name !== form.originalName && kind === 'specialties' && form.doctor_count > 0 && (
        <p className="sm:col-span-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          Renaming also changes the specialty on its {form.doctor_count} doctor(s). The page address stays the same.
        </p>
      )}
      {error && <p role="alert" className="sm:col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2 mt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-primary text-white min-h-11 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 min-h-11 py-2 rounded-lg text-sm bg-white">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminCatalogTab({ kind }) {
  const { title, one, path } = KINDS[kind];
  const [items, setItems] = useState([]);
  const [specialtyNames, setSpecialtyNames] = useState([]);
  const [form, setForm] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  function reload() { api.get(`/admin/${kind}`).then(setItems); }
  useEffect(() => {
    reload();
    setForm(null);
    if (kind === 'symptoms') api.get('/admin/specialties').then(list => setSpecialtyNames(list.map(s => s.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const visible = useMemo(() => items.filter(i =>
    !search || [i.name, i.name_bn].some(n => n?.toLowerCase().includes(search.toLowerCase()))), [items, search]);

  function open(item) {
    setError('');
    setNotice('');
    setPendingImage(null);
    setForm(item ? { ...toForm(item), originalName: item.name } : BLANK);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = form.id ? await api.patch(`/admin/${kind}/${form.id}`, toBody(form)) : await api.post(`/admin/${kind}`, toBody(form));
      if (pendingImage) {
        const fd = new FormData();
        fd.append('photo', pendingImage);
        try {
          await api.upload(`/admin/${kind}/${saved.id}/photo`, fd);
        } catch (err) {
          reload();
          open(saved);
          setError(`Saved, but the image didn't upload: ${err.message}`);
          return;
        }
      }
      if (saved.renamedDoctors) setNotice(`Renamed to "${saved.name}" on ${saved.renamedDoctors} doctor(s).`);
      setForm(null);
      setPendingImage(null);
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
        <h2 className="text-xl font-bold text-gray-800">{title} <span className="text-gray-400 font-normal text-base">({visible.length})</span></h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white w-64">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="flex-1 text-sm outline-none bg-transparent" />
          </div>
          <button onClick={() => open(null)} className="flex items-center gap-1 text-sm font-medium text-primary border border-primary rounded-lg px-3 py-2 bg-white whitespace-nowrap">
            <Plus size={14} /> Add {one}
          </button>
        </div>
      </div>
      {notice && <p role="status" className="mb-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{notice}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map(item => (
          <div key={item.id} onClick={() => open(item)}
            className={`${item.hidden ? 'opacity-60' : ''} bg-white rounded-xl shadow-sm p-3 flex justify-between items-center text-sm cursor-pointer hover:shadow-md hover:bg-gray-50 transition-shadow`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {item.image
                ? <img src={item.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                : <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-base">{item.icon || <Stethoscope size={16} className="text-gray-300" />}</span>}
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">{item.name}{item.hidden && <span className="ml-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">Hidden</span>}</p>
                <p className="text-xs text-gray-500 truncate">{item.name_bn || 'No Bangla name yet'}</p>
                <p className="text-xs text-primary">
                  {kind === 'specialties' ? `${item.doctor_count} doctor(s)` : `${item.specialties.length ? item.specialties.join(', ') : 'No specialists linked'}`}
                  {!item.description && ' · no description'}
                </p>
              </div>
            </div>
            <Pencil size={16} className="text-gray-400 flex-shrink-0 ml-2" />
          </div>
        ))}
      </div>
      {visible.length === 0 && <div className="text-center py-16 text-gray-400 text-sm">No {title.toLowerCase()} match.</div>}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-scrim" onClick={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="glass-panel rounded-2xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-base">{form.id ? `Edit ${one}` : `Add ${one}`}</h3>
              <button onClick={() => setForm(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {form.id && !form.hidden && <p className="text-xs text-gray-500 mb-3">Public page: <a href={`${path}/${form.slug}`} target="_blank" rel="noreferrer" className="text-primary">{path}/{form.slug}</a></p>}
            <CatalogForm kind={kind} form={form} setForm={setForm} specialtyNames={specialtyNames}
              pendingImage={pendingImage} setPendingImage={setPendingImage}
              onSave={handleSave} onCancel={() => setForm(null)} error={error} saving={saving}
              actions={form.id && <AdminRecordActions path={`/admin/${kind}/${form.id}`} hidden={form.hidden} label={one}
                onHiddenChange={hidden => { setForm(f => ({ ...f, hidden })); reload(); }}
                onDeleted={() => { setForm(null); reload(); }} />} />
          </div>
        </div>
      )}
    </div>
  );
}
