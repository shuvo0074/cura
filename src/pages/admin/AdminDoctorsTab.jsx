import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { api } from '../../api/client';

const BLANK = {
  name: '', specialty: '', department: '', experience: '', chamber: '', fees: '',
  city: '', hospitalId: '', phone: '', photo: '', rating: '', about: '', website: '',
  bmdcNo: '', education: '', languages: '', consultingHours: '', address: '',
  clinicalExpertise: '', treatments: '',
};

// Postgres returns clinical_expertise/treatments as real arrays; the form edits them as comma-separated text.
function toEditableForm(d) {
  return {
    ...d,
    clinicalExpertise: Array.isArray(d.clinical_expertise) ? d.clinical_expertise.join(', ') : (d.clinicalExpertise ?? ''),
    treatments: Array.isArray(d.treatments) ? d.treatments.join(', ') : (d.treatments ?? ''),
  };
}

export default function AdminDoctorsTab() {
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [form, setForm] = useState(null);

  function reload() {
    api.get('/doctors').then(setDoctors);
  }

  useEffect(() => {
    reload();
    api.get('/hospitals').then(setHospitals);
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (form.id) {
      await api.patch(`/admin/doctors/${form.id}`, form);
    } else {
      await api.post('/admin/doctors', form);
    }
    setForm(null);
    reload();
  }

  return (
    <div>
      <button onClick={() => setForm(BLANK)}
        className="flex items-center gap-1 text-sm font-medium text-primary border border-primary rounded-lg px-3 py-1.5 mb-4 bg-white">
        <Plus size={14} /> Add Doctor
      </button>

      {form && (
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {['name', 'specialty', 'department', 'experience', 'chamber', 'fees', 'city', 'phone', 'photo', 'rating', 'about', 'website',
            'bmdcNo', 'education', 'languages', 'consultingHours', 'address', 'clinicalExpertise', 'treatments'].map(field => (
            <input key={field} placeholder={field} value={form[field] ?? ''}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none" />
          ))}
          <select value={form.hospitalId ?? ''} onChange={e => setForm(f => ({ ...f, hospitalId: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none">
            <option value="">No hospital</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <div className="flex gap-2 mt-2 sm:col-span-2">
            <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium">Save</button>
            <button type="button" onClick={() => setForm(null)} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm bg-white">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {doctors.map(d => (
          <div key={d.id} className="bg-white rounded-xl shadow-sm p-3 flex justify-between items-center text-sm">
            <div>
              <p className="font-medium text-gray-800">{d.name}</p>
              <p className="text-xs text-gray-500">{d.specialty} · {d.hospital_name || 'No hospital'}</p>
            </div>
            <button onClick={() => setForm(toEditableForm({ ...d, hospitalId: d.hospital_id ?? '' }))} className="text-gray-400 hover:text-primary">
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
