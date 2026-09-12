import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';

const DAYS = [
  { label: 'Sat', dow: 6 },
  { label: 'Sun', dow: 0 },
  { label: 'Mon', dow: 1 },
  { label: 'Tue', dow: 2 },
  { label: 'Wed', dow: 3 },
  { label: 'Thu', dow: 4 },
  { label: 'Fri', dow: 5 },
];

function nextDateForDow(dow) {
  const today = new Date();
  const diff = (dow - today.getDay() + 7) % 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}

export default function SlotPicker({ doctorId, initialDay = null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [slots, setSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState('');
  const rootRef = useRef(null);

  const selectedDate = selectedDay != null ? nextDateForDow(selectedDay) : null;

  useEffect(() => {
    if (selectedDay == null) return;
    function handleOutsideClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setSelectedDay(null);
        setSelectedTime(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedDay]);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedTime(null);
    api.get(`/doctors/${doctorId}/slots?date=${selectedDate}`)
      .then(res => setSlots(res.slots))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, doctorId]);

  async function handleBook() {
    if (!user || user.role !== 'patient') {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBooking(true);
    setMessage('');
    try {
      await api.post('/appointments', { doctorId, date: selectedDate, time: selectedTime });
      navigate('/appointments');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBooking(false);
    }
  }

  return (
    <div ref={rootRef}>
      <div className="grid grid-cols-4 gap-2">
        {DAYS.map(({ label, dow }) => (
          <button key={dow} onClick={() => setSelectedDay(dow)}
            className={`border rounded-lg py-2 text-xs font-medium transition-all
              ${selectedDay === dow ? 'bg-primary text-white border-primary shadow-sm' : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary hover:-translate-y-0.5'}`}>
            {label}
          </button>
        ))}
      </div>

      {selectedDay != null && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">{selectedDate}</p>
          {loadingSlots ? (
            <p className="text-xs text-gray-400">Loading slots...</p>
          ) : slots.length === 0 ? (
            <p className="text-xs text-gray-400">No slots available this day.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map(time => (
                <button key={time} onClick={() => setSelectedTime(time)}
                  className={`border rounded-lg py-1.5 text-xs font-medium transition-all
                    ${selectedTime === time ? 'bg-primary text-white border-primary shadow-sm' : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary hover:-translate-y-0.5'}`}>
                  {time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {message && <p className="text-red-500 text-xs mt-2">{message}</p>}

      <button
        onClick={handleBook}
        disabled={!selectedTime || booking}
        className="w-full mt-3 bg-primary text-white py-2.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md hover:brightness-105 disabled:opacity-40 disabled:shadow-none transition-all">
        {booking ? 'Booking...' : 'Book Appointment'}
      </button>
    </div>
  );
}
