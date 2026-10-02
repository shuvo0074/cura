import { useEffect, useState, useMemo, useRef } from 'react';
import { Plus, Pencil, SlidersHorizontal, Search, X, Building2 } from 'lucide-react';
import { api } from '../../api/client';
import divisions from '../../data/divisions.json';
import { citiesForDivisions } from '../../utils/geo';

const BLANK = { name: '', location: '', division: '', address: '', hotline: '', photo: '', website: '', description: '' };

function toggleInArray(arr, item) {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

function FilterSection({ title, placeholder, items, selected, onToggle }) {
  const [q, setQ] = useState('');
  const visible = items.filter(i => i.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="border-b border-gray-100 pb-3 mb-3">
      <p className="text-sm font-semibold text-gray-800 mb-2">{title}</p>
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2">
        <Search size={13} className="text-gray-400 flex-shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
          className="flex-1 text-xs outline-none bg-transparent" />
      </div>
      <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
        {visible.map(item => (
          <label key={item} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} className="accent-primary" />
            {item}
          </label>
        ))}
        {visible.length === 0 && <p className="text-xs text-gray-400">No matches.</p>}
      </div>
    </div>
  );
}

function HospitalForm({ form, setForm, onSave, onCancel, editingId }) {
  const fileRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.upload(`/admin/hospitals/${editingId}/photo`, fd);
      setForm(f => ({ ...f, photo: res.photo }));
    } finally {
      setPhotoLoading(false);
      e.target.value = '';
    }
  }

  async function handleRemove() {
    setPhotoLoading(true);
    try {
      await api.del(`/admin/hospitals/${editingId}/photo`);
      setForm(f => ({ ...f, photo: null }));
    } finally {
      setPhotoLoading(false);
    }
  }

  return (
    <form onSubmit={onSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Photo row — upload UI in edit mode, URL text field in add mode */}
      <div className="sm:col-span-2 flex items-center gap-4 pb-3 border-b border-gray-100">
        {editingId ? (
          <>
            {form.photo
              ? <img src={form.photo} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
              : <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Building2 size={26} className="text-gray-300" />
                </div>
            }
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500">Photo</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={photoLoading}
                  className="text-xs px-3 py-1.5 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 disabled:opacity-50 transition-colors">
                  {photoLoading ? 'Uploading…' : 'Upload Photo'}
                </button>
                {form.photo && (
                  <button type="button" onClick={handleRemove} disabled={photoLoading}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                    Remove
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
          </>
        ) : (
          <label className="flex flex-col gap-1 w-full">
            <span className="text-xs font-medium text-gray-500">Photo URL</span>
            <input placeholder="Photo URL" value={form.photo ?? ''}
              onChange={e => setForm(f => ({ ...f, photo: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs font-medium text-gray-500">Hospital Name</span>
        <input placeholder="Hospital Name" value={form.name ?? ''}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">City / Location</span>
        <input placeholder="City / Location" value={form.location ?? ''}
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">Division</span>
        <select value={form.division ?? ''} onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">No division</option>
          {divisions.map(d => <option key={d} value={d}>{d} Division</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs font-medium text-gray-500">Address</span>
        <input placeholder="Address" value={form.address ?? ''}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">Hotline</span>
        <input placeholder="Hotline" value={form.hotline ?? ''}
          onChange={e => setForm(f => ({ ...f, hotline: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">Website</span>
        <input placeholder="Website" value={form.website ?? ''}
          onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs font-medium text-gray-500">Description</span>
        <textarea placeholder="Short description of the hospital…" value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={3}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none resize-none" />
      </label>
      <div className="flex gap-2 sm:col-span-2 mt-1">
        <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium">Save</button>
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm bg-white">Cancel</button>
      </div>
    </form>
  );
}

const EMPTY_FILTERS = { division: [], district: [] };

export default function AdminHospitalsTab() {
  const [hospitals, setHospitals] = useState([]);
  const [addForm, setAddForm] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');

  function reload() { api.get('/hospitals').then(setHospitals); }
  useEffect(reload, []);

  const districtOptions = useMemo(() => citiesForDivisions(filters.division), [filters.division]);

  const filtered = useMemo(() => hospitals.filter(h => {
    if (search && !h.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.division.length && !filters.division.includes(h.division)) return false;
    if (filters.district.length && !filters.district.includes(h.location)) return false;
    return true;
  }), [hospitals, search, filters]);

  const hasActiveFilters = filters.division.length || filters.district.length || search;

  async function handleSave(form, closeForm) {
    if (form.id) {
      await api.patch(`/admin/hospitals/${form.id}`, form);
    } else {
      await api.post('/admin/hospitals', form);
    }
    closeForm();
    reload();
  }

  function handleDivisionToggle(div) {
    setFilters(f => {
      const nextDivisions = toggleInArray(f.division, div);
      const allowed = new Set(citiesForDivisions(nextDivisions));
      return { ...f, division: nextDivisions, district: f.district.filter(d => allowed.has(d)) };
    });
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Filter sidebar */}
      <aside className="w-full md:w-52 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-sm p-4 md:sticky md:top-20 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
              <SlidersHorizontal size={15} /> Filter By
            </span>
            {hasActiveFilters && (
              <button onClick={() => { setFilters(EMPTY_FILTERS); setSearch(''); }}
                className="text-xs text-primary font-medium flex items-center gap-1">
                <X size={11} /> Clear
              </button>
            )}
          </div>
          <FilterSection title="By Division" placeholder="Search Division" items={divisions}
            selected={filters.division} onToggle={handleDivisionToggle} />
          <FilterSection title="By District" placeholder="Search District" items={districtOptions}
            selected={filters.district}
            onToggle={v => setFilters(f => ({ ...f, district: toggleInArray(f.district, v) }))} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Hospitals <span className="text-gray-400 font-normal text-base">({filtered.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white w-64">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for Hospitals"
                className="flex-1 text-sm outline-none bg-transparent" />
            </div>
            <button onClick={() => { setAddForm(BLANK); setEditForm(null); }}
              className="flex items-center gap-1 text-sm font-medium text-primary border border-primary rounded-lg px-3 py-2 bg-white whitespace-nowrap">
              <Plus size={14} /> Add Hospital
            </button>
          </div>
        </div>

        {/* Inline add form */}
        {addForm && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <HospitalForm form={addForm} setForm={setAddForm}
              onSave={e => { e.preventDefault(); handleSave(addForm, () => setAddForm(null)); }}
              onCancel={() => setAddForm(null)} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(h => (
            <div key={h.id} className="bg-white rounded-xl shadow-sm p-3 flex justify-between items-center text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                {h.photo
                  ? <img src={h.photo} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                  : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-gray-300" />
                    </div>
                }
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{h.name}</p>
                  <p className="text-xs text-gray-500 truncate">{h.location}</p>
                </div>
              </div>
              <button onClick={() => { setEditForm(h); setAddForm(null); }} className="text-gray-400 hover:text-primary flex-shrink-0 ml-2">
                <Pencil size={16} />
              </button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">No hospitals match the current filters.</div>
        )}
      </div>

      {/* Edit modal */}
      {editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setEditForm(null); }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-base">Edit Hospital</h3>
              <button onClick={() => setEditForm(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <HospitalForm form={editForm} setForm={setEditForm}
              editingId={editForm.id}
              onSave={e => { e.preventDefault(); handleSave(editForm, () => setEditForm(null)); }}
              onCancel={() => setEditForm(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
