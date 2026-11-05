import { useCallback, useEffect, useState } from 'react';
import { Building2, MapPin, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// A patient chooses clinics. Each one sees them as a patient on Cura Dashboard.
export default function MyClinicsPage() {
  const { t } = useTranslation();
  const [clinics, setClinics] = useState([]);
  const [joined, setJoined] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [all, mine] = await Promise.all([api.get('/clinics'), api.get('/my-clinics')]);
    setClinics(all);
    setJoined(new Set(mine.map(clinic => clinic.id)));
  }, []);

  useEffect(() => {
    load()
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [load]);

  async function toggle(clinic) {
    setBusyId(clinic.id);
    setError('');
    try {
      if (joined.has(clinic.id)) await api.del(`/my-clinics/${clinic.id}`);
      else await api.put(`/my-clinics/${clinic.id}`, {});
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('mc_title')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">{t('mc_sub')}</p>
      {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
      {!loading && clinics.length === 0 && <p className="text-sm text-gray-500">{t('mc_empty')}</p>}
      <div className="flex flex-col gap-3">
        {clinics.map(clinic => {
          const isJoined = joined.has(clinic.id);
          const where = clinic.address || [clinic.locality, clinic.city].filter(Boolean).join(', ');
          return (
            <div key={clinic.id} className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 size={16} className="text-primary flex-shrink-0" /> {clinic.name}
                </p>
                {where && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                    <MapPin size={13} className="flex-shrink-0" /> {where}
                  </p>
                )}
                {clinic.contact_number && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                    <Phone size={13} className="flex-shrink-0" /> {clinic.contact_number}
                  </p>
                )}
                {isJoined && <p className="text-xs font-medium text-action mt-1">{t('mc_joined')}</p>}
              </div>
              <button type="button" disabled={busyId === clinic.id} onClick={() => toggle(clinic)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex-shrink-0 ${
                  isJoined ? 'border border-gray-200 text-gray-700' : 'bg-primary text-white'
                }`}>
                {isJoined ? t('mc_leave') : t('mc_join')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
