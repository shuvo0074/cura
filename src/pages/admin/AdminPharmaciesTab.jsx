import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../../api/client';

// Super admin only: show or hide pharmacies on the Pharmacies page. Adding and
// editing pharmacies happens on Cura Dashboard, the main admin panel.
export default function AdminPharmaciesTab() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.get('/admin/pharmacies')
    .then(setPharmacies)
    .catch(err => setError(err.message))
    .finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);

  async function toggle(pharmacy) {
    setBusyId(pharmacy.id);
    setError('');
    try {
      const res = await api.patch(`/admin/pharmacies/${pharmacy.id}/hidden`, { hidden: !pharmacy.hidden });
      setPharmacies(list => list.map(p => (p.id === pharmacy.id ? { ...p, hidden: res.hidden } : p)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-gray-900">Pharmacies</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          A pharmacy an owner adds stays hidden until you show it. To add or edit pharmacies, use Cura Dashboard: Super Admin, then Pharmacies.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : pharmacies.length === 0 ? (
        <p className="text-sm text-gray-500">No pharmacies yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {pharmacies.map(pharmacy => (
            <li key={pharmacy.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {pharmacy.name}
                  {pharmacy.hidden && <span className="ml-2 text-xs font-semibold text-amber-700">Hidden</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {[[pharmacy.address, pharmacy.city].filter(Boolean).join(', '), pharmacy.phones.join(', '), pharmacy.owner?.full_name && `Owner: ${pharmacy.owner.full_name}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" onClick={() => toggle(pharmacy)} disabled={busyId === pharmacy.id}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 rounded-lg font-medium bg-white hover:bg-gray-50 disabled:opacity-50">
                {pharmacy.hidden ? <><Eye size={13} /> Show on site</> : <><EyeOff size={13} /> Hide from site</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
