import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { api } from '../../api/client';

const BLANK = { name: '', location: '', address: '', hotline: '', photo: '', website: '' };

export default function AdminHospitalsTab() {
  const [hospitals, setHospitals] = useState([]);
  const [form, setForm] = useState(null);

  function reload() {
    api.get('/hospitals').then(setHospitals);
  }

  useEffect(reload, []);

  async function handleSave(e) {
    e.preventDefault();
    if (form.id) {
      await api.patch(`/admin/hospitals/${form.id}`, form);
    } else {
      await api.post('/admin/hospitals', form);
    }
    setForm(null);
    reload();
  }

  return (
    <div>
      <button onClick={() => setForm(BLANK)}
        className="flex items-center gap-1 text-sm font-medium text-primary border border-primary rounded-lg px-3 py-1.5 mb-4 bg-white">
        <Plus size={14} /> Add Hospital
      </button>

      {form && (
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {['name', 'location', 'address', 'hotline', 'photo', 'website'].map(field => (
            <input key={field} placeholder={field} value={form[field] ?? ''}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none" />
          ))}
          <div className="flex gap-2 mt-2 sm:col-span-2">
            <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium">Save</button>
            <button type="button" onClick={() => setForm(null)} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm bg-white">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {hospitals.map(h => (
          <div key={h.id} className="bg-white rounded-xl shadow-sm p-3 flex justify-between items-center text-sm">
            <div>
              <p className="font-medium text-gray-800">{h.name}</p>
              <p className="text-xs text-gray-500">{h.location}</p>
            </div>
            <button onClick={() => setForm(h)} className="text-gray-400 hover:text-primary">
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
