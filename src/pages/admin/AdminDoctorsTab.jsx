import { Fragment, useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, SlidersHorizontal, Search, X, UserRound } from 'lucide-react';
import { api } from '../../api/client';
import divisions from '../../data/divisions.json';
import { citiesForDivisions, toggleDivision } from '../../utils/geo';

import DoctorChambersFields from './DoctorChambersFields';
import AdminPhotoField from './AdminPhotoField';
import AdminRecordActions from './AdminRecordActions';

const BLANK = {
  name: '', gender: '', specialty: '', department: '', experience: '', chamber: '', fees: '', workplace: '', followupFees: '300',
  city: '', division: '', hospitalId: '', phone: '', photo: '', rating: '', about: '', website: '',
  bmdcNo: '', education: '', languages: '', consultingHours: '', address: '',
  clinicalExpertise: '', treatments: '', weeklySchedule: [],
  lat: '', lng: '', source_url: '', verified_on: '',
};

const OTHER = '__other__';

function toEditableForm(d) {
  return {
    ...d,
    weeklySchedule: d.weekly_schedule ?? [],
    followupFees: d.followup_fees ?? '',
    // The form and API body use camelCase. Without these, saving erases them.
    bmdcNo: d.bmdc_no ?? d.bmdcNo ?? '',
    consultingHours: d.consulting_hours ?? d.consultingHours ?? '',
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

// Fields rendered as generic inputs (photo, specialty and the selects are handled separately)
const DOCTOR_FIELDS = [
  { key: 'name',            label: 'Full Name' },
  { key: 'department',      label: 'Department' },
  { key: 'experience',      label: 'Experience' },
  { key: 'chamber',         label: 'Chamber' },
  { key: 'fees',            label: 'Consultation Fees' },
  { key: 'followupFees', label: 'Follow-up Fees' },
  { key: 'workplace', label: 'Workplace' },
  { key: 'phone',           label: 'Mobile number (required: the doctor signs up with it)' },
  { key: 'rating',          label: 'Rating (0–5)', type: 'number', min: 0, max: 5, step: 0.1 },
  { key: 'about',           label: 'About' },
  { key: 'website',         label: 'Website' },
  { key: 'bmdcNo',          label: 'BMDC No.' },
  { key: 'education',       label: 'Education' },
  { key: 'languages',       label: 'Languages' },
  { key: 'consultingHours', label: 'Consulting Hours' },
  { key: 'address',         label: 'Address' },
  { key: 'clinicalExpertise', label: 'Clinical Expertise' },
  { key: 'treatments',      label: 'Treatments' },
  { key: 'lat',             label: 'Latitude', type: 'number', step: 'any', min: -90, max: 90 },
  { key: 'lng',             label: 'Longitude', type: 'number', step: 'any', min: -180, max: 180 },
  { key: 'source_url',      label: 'Source link', type: 'url', placeholder: 'https://…' },
  { key: 'verified_on',     label: 'Checked on', type: 'date' },
];

// Known specialties plus any already in use, so an existing doctor's
// specialty always shows in the dropdown.
function SpecialtySelect({ value, options, onChange }) {
  const [custom, setCustom] = useState(() => Boolean(value) && !options.includes(value));
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">Specialty</span>
      <select value={custom ? OTHER : value ?? ''} required={!custom}
        onChange={e => { const v = e.target.value; setCustom(v === OTHER); onChange(v === OTHER ? '' : v); }}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
        <option value="">Choose a specialty</option>
        {options.map(name => <option key={name} value={name}>{name}</option>)}
        <option value={OTHER}>Other…</option>
      </select>
      {custom && (
        <input autoFocus required placeholder="New specialty name" value={value ?? ''} onChange={e => onChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
      )}
    </label>
  );
}

function DoctorForm({ form, setForm, hospitals, specialtyOptions, onSave, onCancel, editingId, error, saving, pendingPhoto, setPendingPhoto, actions }) {
  const districtOptions = useMemo(
    () => form.division ? citiesForDivisions([form.division]) : citiesForDivisions(divisions),
    [form.division]
  );

  function handleDivisionChange(e) {
    const div = e.target.value;
    const allowed = new Set(div ? citiesForDivisions([div]) : citiesForDivisions(divisions));
    setForm(f => ({ ...f, division: div, city: allowed.has(f.city) ? f.city : '' }));
  }

  return (
    <form onSubmit={onSave} className={editingId ? "flex flex-col flex-1 min-h-0" : ""}>
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${editingId ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6' : ''}`}>
      {actions}
      <div className="col-span-2 sm:col-span-3 pb-3 border-b border-gray-100">
        <AdminPhotoField photo={form.photo} uploadPath={editingId ? `/admin/doctors/${editingId}/photo` : null}
          pendingFile={pendingPhoto} onPendingFile={setPendingPhoto}
          onPhoto={photo => setForm(f => ({ ...f, photo }))}
          placeholder={<UserRound size={26} className="text-gray-300" />} />
      </div>

      <label className="col-span-full flex flex-col gap-1 rounded-xl border border-primary/20 bg-primary/5 p-3"><span className="text-sm font-semibold text-primary">Doctor gender</span>
        <select value={form.gender ?? ''} onChange={event => setForm(f => ({ ...f, gender: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option>
        </select>
      </label>
      {DOCTOR_FIELDS.map(({ key, label, placeholder, ...input }) => (
        <Fragment key={key}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">{label}</span>
            <input {...input} placeholder={placeholder ?? label} value={form[key] ?? ''} required={key === 'name'}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
          </label>
          {key === 'name' && (
            <SpecialtySelect key={editingId ?? 'new'} value={form.specialty} options={specialtyOptions}
              onChange={specialty => setForm(f => ({ ...f, specialty }))} />
          )}
        </Fragment>
      ))}
      <DoctorChambersFields entries={form.weeklySchedule ?? []} hospitals={hospitals} onChange={weeklySchedule => setForm(f => ({ ...f, weeklySchedule }))} />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">Primary hospital or diagnostic centre</span>
        <select value={form.hospitalId ?? ''} onChange={e => setForm(f => ({ ...f, hospitalId: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">No primary affiliation</option>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}{h.hidden ? ' (hidden)' : ''}</option>)}
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
      </div>
      {error && <p role="alert" className={`text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 ${editingId ? 'mx-6 mt-3' : 'mt-3'}`}>{error}</p>}
      <div className={editingId ? "flex gap-2 flex-shrink-0 border-t border-gray-200 bg-white px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]" : "flex gap-2 mt-3"}>
        <button type="submit" disabled={saving} className="flex-1 bg-primary text-white min-h-11 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 min-h-11 py-2 rounded-lg text-sm bg-white">Cancel</button>
      </div>
    </form>
  );
}

const EMPTY_FILTERS = { specialty: [], division: [], city: [], visibility: [] };

export default function AdminDoctorsTab() {
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [addForm, setAddForm] = useState(null);   // inline
  const [editForm, setEditForm] = useState(null); // modal
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [specSearch, setSpecSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [specialties, setSpecialties] = useState([]);

  function reload() { api.get('/admin/doctors').then(setDoctors); }

  useEffect(() => {
    reload();
    api.get('/admin/hospitals').then(setHospitals);
    api.get('/admin/specialties').then(setSpecialties);
  }, []);

  const specialtyNames = useMemo(() =>
    [...new Set(doctors.map(d => d.specialty).filter(Boolean))].sort(), [doctors]);

  // The Specialties tab's list, plus any value a doctor still has that isn't on it.
  const specialtyOptions = useMemo(() =>
    [...new Set([...specialties.map(s => s.name), ...specialtyNames])].sort(), [specialties, specialtyNames]);

  const cities = useMemo(() => citiesForDivisions(filters.division), [filters.division]);

  const filtered = useMemo(() => doctors.filter(d => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.specialty.length && !filters.specialty.includes(d.specialty)) return false;
    if (filters.division.length && !filters.division.includes(d.division)) return false;
    if (filters.city.length && !filters.city.includes(d.city)) return false;
    if (filters.visibility.length && !filters.visibility.includes(d.hidden ? 'Hidden' : 'Visible')) return false;
    return true;
  }), [doctors, search, filters]);

  const hasActiveFilters = filters.specialty.length || filters.division.length || filters.city.length || filters.visibility.length || search;

  function openAdd() { setAddForm(BLANK); setEditForm(null); setError(''); setPendingPhoto(null); }
  function openEdit(d) { setEditForm(toEditableForm({ ...d, hospitalId: d.hospital_id ?? '' })); setAddForm(null); setError(''); setPendingPhoto(null); }

  async function handleSave(form, closeForm) {
    setSaving(true);
    setError('');
    try {
      if (form.id) {
        await api.patch(`/admin/doctors/${form.id}`, form);
      } else {
        const created = await api.post('/admin/doctors', form);
        if (pendingPhoto) {
          const fd = new FormData();
          fd.append('photo', pendingPhoto);
          try {
            await api.upload(`/admin/doctors/${created.id}/photo`, fd);
          } catch (err) {
            // The doctor is saved; reopen it so the photo can be retried.
            reload();
            openEdit({ ...created, hospital_id: created.hospital_id });
            setError(`Doctor saved, but the photo didn't upload: ${err.message}`);
            return;
          }
        }
      }
      setPendingPhoto(null);
      closeForm();
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
          <FilterSection title="Visibility" searchable={false} items={['Visible', 'Hidden']}
            selected={filters.visibility} onToggle={v => setFilters(f => ({ ...f, visibility: toggleInArray(f.visibility, v) }))} />
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
            <button onClick={openAdd}
              className="flex items-center gap-1 text-sm font-medium text-primary border border-primary rounded-lg px-3 py-2 bg-white whitespace-nowrap">
              <Plus size={14} /> Add Doctor
            </button>
          </div>
        </div>

        {/* Inline add form */}
        {addForm && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <DoctorForm form={addForm} setForm={setAddForm} hospitals={hospitals} specialtyOptions={specialtyOptions}
              error={error} saving={saving} pendingPhoto={pendingPhoto} setPendingPhoto={setPendingPhoto}
              onSave={e => { e.preventDefault(); handleSave(addForm, () => setAddForm(null)); }}
              onCancel={() => setAddForm(null)} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(d => (
            <div key={d.id} onClick={() => openEdit(d)} className={`${d.hidden ? 'opacity-60' : ''} bg-white rounded-xl shadow-sm p-3 flex justify-between items-center text-sm cursor-pointer hover:shadow-md hover:bg-gray-50 transition-shadow`}>
              <div className="flex items-center gap-2.5 min-w-0">
                {d.photo
                  ? <img src={d.photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                  : <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <UserRound size={16} className="text-gray-300" />
                    </div>
                }
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{d.name}{d.hidden && <span className="ml-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">Hidden</span>}</p>
                  <p className="text-xs text-gray-500 truncate">{d.specialty} · {d.hospital_name || 'No hospital'}</p>
                  <p className="text-xs text-primary">Gender: {d.gender === 'female' ? 'Female' : d.gender === 'male' ? 'Male' : 'Not specified'}{d.gender_is_demo ? ' · Sample data' : ''}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-scrim"
          onClick={e => { if (e.target === e.currentTarget) setEditForm(null); }}>
          <div className="glass-panel rounded-2xl w-full max-w-3xl mx-4 h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0 px-6 pt-6 pb-4">
              <h3 className="font-semibold text-gray-800 text-base">Edit Doctor</h3>
              <button onClick={() => setEditForm(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <DoctorForm form={editForm} setForm={setEditForm} hospitals={hospitals} specialtyOptions={specialtyOptions}
              error={error} saving={saving}
              actions={<AdminRecordActions path={`/admin/doctors/${editForm.id}`} hidden={editForm.hidden} label="doctor"
                onHiddenChange={hidden => { setEditForm(f => ({ ...f, hidden })); reload(); }}
                onDeleted={() => { setEditForm(null); reload(); }} />}
              editingId={editForm.id}
              onSave={e => { e.preventDefault(); handleSave(editForm, () => setEditForm(null)); }}
              onCancel={() => setEditForm(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
