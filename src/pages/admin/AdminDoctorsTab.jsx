import { useEffect, useState, useMemo, useRef } from 'react';
import { Plus, Pencil, SlidersHorizontal, Search, X, UserRound } from 'lucide-react';
import { api } from '../../api/client';
import divisions from '../../data/divisions.json';
import { citiesForDivisions, toggleDivision } from '../../utils/geo';

const BLANK = {
  name: '', specialty: '', department: '', experience: '', chamber: '', fees: '',
  city: '', division: '', hospitalId: '', phone: '', photo: '', rating: '', about: '', website: '',
  bmdcNo: '', education: '', languages: '', consultingHours: '', address: '',
  clinicalExpertise: '', treatments: '',
};

function toEditableForm(d) {
  return {
    ...d,
    clinicalExpertise: Array.isArray(d.clinical_expertise) ? d.clinical_expertise.join(', ') : (d.clinicalExpertise ?? ''),
    treatments: Array.isArray(d.treatments) ? d.treatments.join(', ') : (d.treatments ?? ''),
  };
}

function toggleInArray(arr, item) {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

function FilterSection({ title, searchValue = '', onSearchChange, items, selected, onToggle, searchable = true }) {
  const filtered = items.filter(i => i.toLowerCase().includes((searchValue || '').toLowerCase()));
  return (
    <div className="border-b border-gray-100 pb-3 mb-3">
      <p className="text-sm font-semibold text-gray-800 mb-2">{title}</p>
      {searchable && (
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input value={searchValue} onChange={e => onSearchChange(e.target.value)}
            placeholder={`Search ${title}`} className="flex-1 text-xs outline-none bg-transparent" />
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1">
        {filtered.map(item => (
          <label key={item} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} className="accent-primary" />
            {item}
          </label>
        ))}
        {filtered.length === 0 && <p className="text-xs text-gray-400">No matches.</p>}
      </div>
    </div>
  );
}

// Fields rendered as generic text inputs (photo is handled separately)
const DOCTOR_FIELDS = [
  { key: 'name',            label: 'Full Name' },
  { key: 'specialty',       label: 'Specialty' },
  { key: 'department',      label: 'Department' },
  { key: 'experience',      label: 'Experience' },
  { key: 'chamber',         label: 'Chamber' },
  { key: 'fees',            label: 'Consultation Fees' },
  { key: 'phone',           label: 'Phone' },
  { key: 'rating',          label: 'Rating' },
  { key: 'about',           label: 'About' },
  { key: 'website',         label: 'Website' },
  { key: 'bmdcNo',          label: 'BMDC No.' },
  { key: 'education',       label: 'Education' },
  { key: 'languages',       label: 'Languages' },
  { key: 'consultingHours', label: 'Consulting Hours' },
  { key: 'address',         label: 'Address' },
  { key: 'clinicalExpertise', label: 'Clinical Expertise' },
  { key: 'treatments',      label: 'Treatments' },
];

function DoctorForm({ form, setForm, hospitals, onSave, onCancel, editingId }) {
  const fileRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const districtOptions = useMemo(
    () => form.division ? citiesForDivisions([form.division]) : citiesForDivisions(divisions),
    [form.division]
  );

  function handleDivisionChange(e) {
    const div = e.target.value;
    const allowed = new Set(div ? citiesForDivisions([div]) : citiesForDivisions(divisions));
    setForm(f => ({ ...f, division: div, city: allowed.has(f.city) ? f.city : '' }));
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.upload(`/admin/doctors/${editingId}/photo`, fd);
      setForm(f => ({ ...f, photo: res.photo }));
    } finally {
      setPhotoLoading(false);
      e.target.value = '';
    }
  }

  async function handleRemove() {
    setPhotoLoading(true);
    try {
      await api.del(`/admin/doctors/${editingId}/photo`);
      setForm(f => ({ ...f, photo: null }));
    } finally {
      setPhotoLoading(false);
    }
  }

  return (
    <form onSubmit={onSave} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {/* Photo row — upload UI in edit mode, URL text field in add mode */}
      <div className="col-span-2 sm:col-span-3 flex items-center gap-4 pb-3 border-b border-gray-100">
        {editingId ? (
          <>
            {form.photo
              ? <img src={form.photo} alt="" className="w-16 h-16 rounded-full object-cover border border-gray-200 flex-shrink-0" />
              : <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <UserRound size={26} className="text-gray-300" />
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

      {DOCTOR_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">{label}</span>
          <input placeholder={label} value={form[key] ?? ''}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">Hospital</span>
        <select value={form.hospitalId ?? ''} onChange={e => setForm(f => ({ ...f, hospitalId: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">No hospital</option>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">Division</span>
        <select value={form.division ?? ''} onChange={handleDivisionChange}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">No division</option>
          {divisions.map(d => <option key={d} value={d}>{d} Division</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">District</span>
        <select value={form.city ?? ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">No district</option>
          {districtOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="flex gap-2 mt-1 col-span-2 sm:col-span-3">
        <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium">Save</button>
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm bg-white">Cancel</button>
      </div>
    </form>
  );
}

const EMPTY_FILTERS = { specialty: [], division: [], city: [] };

export default function AdminDoctorsTab() {
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [addForm, setAddForm] = useState(null);   // inline
  const [editForm, setEditForm] = useState(null); // modal
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [specSearch, setSpecSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  function reload() { api.get('/doctors').then(setDoctors); }

  useEffect(() => {
    reload();
    api.get('/hospitals').then(setHospitals);
  }, []);

  const specialtyNames = useMemo(() =>
    [...new Set(doctors.map(d => d.specialty).filter(Boolean))].sort(), [doctors]);

  const cities = useMemo(() => citiesForDivisions(filters.division), [filters.division]);

  const filtered = useMemo(() => doctors.filter(d => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.specialty.length && !filters.specialty.includes(d.specialty)) return false;
    if (filters.division.length && !filters.division.includes(d.division)) return false;
    if (filters.city.length && !filters.city.includes(d.city)) return false;
    return true;
  }), [doctors, search, filters]);

  const hasActiveFilters = filters.specialty.length || filters.division.length || filters.city.length || search;

  async function handleSave(form, closeForm) {
    if (form.id) {
      await api.patch(`/admin/doctors/${form.id}`, form);
    } else {
      await api.post('/admin/doctors', form);
    }
    closeForm();
    reload();
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
              <button onClick={() => { setFilters(EMPTY_FILTERS); setSearch(''); setSpecSearch(''); setCitySearch(''); }}
                className="text-xs text-primary font-medium flex items-center gap-1">
                <X size={11} /> Clear
              </button>
            )}
          </div>
          <FilterSection title="Specialities" searchValue={specSearch} onSearchChange={setSpecSearch}
            items={specialtyNames} selected={filters.specialty}
            onToggle={v => setFilters(f => ({ ...f, specialty: toggleInArray(f.specialty, v) }))} />
          <FilterSection title="Select Division" searchable={false} items={divisions}
            selected={filters.division} onToggle={v => setFilters(f => toggleDivision(f, v))} />
          <FilterSection title="Select District" searchValue={citySearch} onSearchChange={setCitySearch}
            items={cities} selected={filters.city}
            onToggle={v => setFilters(f => ({ ...f, city: toggleInArray(f.city, v) }))} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Doctors <span className="text-gray-400 font-normal text-base">({filtered.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white w-64">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for Doctors"
                className="flex-1 text-sm outline-none bg-transparent" />
            </div>
            <button onClick={() => { setAddForm(BLANK); setEditForm(null); }}
              className="flex items-center gap-1 text-sm font-medium text-primary border border-primary rounded-lg px-3 py-2 bg-white whitespace-nowrap">
              <Plus size={14} /> Add Doctor
            </button>
          </div>
        </div>

        {/* Inline add form */}
        {addForm && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <DoctorForm form={addForm} setForm={setAddForm} hospitals={hospitals}
              onSave={e => { e.preventDefault(); handleSave(addForm, () => setAddForm(null)); }}
              onCancel={() => setAddForm(null)} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(d => (
            <div key={d.id} onClick={() => { setEditForm(toEditableForm({ ...d, hospitalId: d.hospital_id ?? '' })); setAddForm(null); }} className="bg-white rounded-xl shadow-sm p-3 flex justify-between items-center text-sm cursor-pointer hover:shadow-md hover:bg-gray-50 transition-shadow">
              <div className="flex items-center gap-2.5 min-w-0">
                {d.photo
                  ? <img src={d.photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                  : <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <UserRound size={16} className="text-gray-300" />
                    </div>
                }
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{d.name}</p>
                  <p className="text-xs text-gray-500 truncate">{d.specialty} · {d.hospital_name || 'No hospital'}</p>
                </div>
              </div>
              <Pencil size={16} className="text-gray-400 flex-shrink-0 ml-2" />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">No doctors match the current filters.</div>
        )}
      </div>

      {/* Edit modal */}
      {editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setEditForm(null); }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-base">Edit Doctor</h3>
              <button onClick={() => setEditForm(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <DoctorForm form={editForm} setForm={setEditForm} hospitals={hospitals}
              editingId={editForm.id}
              onSave={e => { e.preventDefault(); handleSave(editForm, () => setEditForm(null)); }}
              onCancel={() => setEditForm(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
