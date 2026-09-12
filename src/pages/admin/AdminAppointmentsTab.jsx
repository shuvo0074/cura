import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminAppointmentsTab() {
  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    api.get(`/admin/appointments${status ? `?status=${status}` : ''}`).then(setAppointments);
  }, [status]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['', 'confirmed', 'cancelled', 'completed'].map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize
              ${status === s ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}>
            {s || 'all'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {appointments.length === 0 && <p className="text-center text-gray-400 py-10 col-span-full">No appointments.</p>}
        {appointments.map(a => (
          <div key={a.id} className="bg-white rounded-xl shadow-sm p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-gray-800">{a.doctor_name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{a.status}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Patient: {a.patient_phone} · {a.appointment_date.slice(0, 10)} {a.appointment_time.slice(0, 5)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
