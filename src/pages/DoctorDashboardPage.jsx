import { useEffect, useState } from 'react';
import { Calendar, Clock, Phone, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';

export default function DoctorDashboardPage() {
  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  function reload() {
    api.get('/doctors/me/appointments').then(setAppointments).finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function handleComplete(id) {
    const updated = await api.patch(`/doctors/me/appointments/${id}/complete`);
    setAppointments(prev => prev.map(a => (a.id === id ? updated : a)));
  }

  const filtered = status ? appointments.filter(a => a.status === status) : appointments;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Doctor Dashboard</h1>

      <div className="flex gap-2 mb-4">
        {['', 'confirmed', 'completed', 'cancelled'].map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize
              ${status === s ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}>
            {s || 'all'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-16">No appointments.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">{a.patient_name || a.patient_phone}</h3>
                  <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                    <Phone size={11} /> {a.patient_phone}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                  ${a.status === 'confirmed' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                  {a.status}
                </span>
              </div>
              <p className="text-gray-500 text-xs flex items-center gap-1 mt-2">
                <Calendar size={11} /> {a.appointment_date.slice(0, 10)}
                <Clock size={11} className="ml-2" /> {a.appointment_time.slice(0, 5)}
              </p>
              {a.notes && <p className="text-gray-500 text-xs mt-1">Note: {a.notes}</p>}
              {a.status === 'confirmed' && (
                <button onClick={() => handleComplete(a.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
                  <CheckCircle2 size={12} /> Mark Completed
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
