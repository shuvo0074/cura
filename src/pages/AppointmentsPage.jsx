import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, X, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api.get('/appointments/me')
      .then(setAppointments)
      .finally(() => setLoading(false));
  }, [user]);

  async function handleCancel(id) {
    const updated = await api.patch(`/appointments/${id}/cancel`);
    setAppointments(prev => prev.map(a => (a.id === id ? updated : a)));
  }

  if (authLoading || loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
  }

  if (!user || user.role !== 'patient') {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-16">
        <p className="text-gray-500 text-sm">Log in to view your appointments.</p>
        <Link to="/login?redirect=/appointments" className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium">
          Login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('appointments')}</h1>
      {appointments.length === 0 ? (
        <p className="text-center text-gray-400 py-16">{t('no_results')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {appointments.map(a => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 flex gap-3">
              <img src={a.doctor_photo} alt={a.doctor_name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{a.doctor_name}</h3>
                    <p className="text-primary text-xs font-medium">{a.specialty}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                    ${a.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-primary/10 text-primary'}`}>
                    {a.status}
                  </span>
                </div>
                <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                  <Calendar size={11} /> {a.appointment_date.slice(0, 10)}
                  <Clock size={11} className="ml-2" /> {a.appointment_time.slice(0, 5)}
                </p>
                <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {a.chamber}
                </p>
                {a.status === 'confirmed' && (
                  <button onClick={() => handleCancel(a.id)}
                    className="mt-2 flex items-center gap-1 text-xs text-red-500 font-medium">
                    <X size={12} /> Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
