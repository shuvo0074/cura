import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, MapPin, Ticket, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatYmd } from '../../utils/dates';

function Row({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-gray-700">
      <Icon size={16} className="text-primary flex-shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Confirm-and-book dialog for one chamber session (bottom sheet on phones,
// centred dialog from md up). Shows the serial the patient will get and its
// estimated arrival time, then a confirmation with the serial actually
// assigned. Patients who aren't logged in are sent to login and brought back
// to this doctor and date.
export default function BookSerialSheet({ doctor, date, session, onClose, onBooked }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = e => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const isPatient = user?.role === 'patient';
  const loginHref = `/login?redirect=${encodeURIComponent(`${location.pathname}?date=${date}`)}`;

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const appointment = await api.post('/appointments', {
        doctorId: doctor.id, date, venue: session.venue, session: session.time, notes,
      });
      setBooked(appointment);
      onBooked?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const details = (
    <div className="flex flex-col gap-2.5 bg-white/70 border border-black/5 rounded-xl p-4">
      <Row icon={CalendarDays}>{formatYmd(date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Row>
      <Row icon={Clock}>
        {session.time}
        {session.note && <span className="text-gray-500"> · {session.note}</span>}
      </Row>
      <Row icon={MapPin}>
        <span className="font-medium">{session.venue}</span>
        {session.address && <span className="block text-xs text-gray-500 mt-0.5">{session.address}</span>}
      </Row>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="book-serial-title">
      <div className="absolute inset-0 glass-scrim animate-[fadeIn_150ms_ease-out]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px] md:rounded-2xl
        glass-panel flex flex-col animate-[sheetUp_200ms_ease-out] md:animate-[fadeIn_150ms_ease-out]">
        <div className="flex justify-center pt-2.5 pb-1 md:hidden" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-black/15" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-black/5">
          <h2 id="book-serial-title" className="font-semibold text-gray-900">{booked ? t('serial_confirmed') : t('book_serial')}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('close')} className="text-gray-500 p-2 -mr-2 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="font-semibold text-gray-900">{doctor.name}</p>
            <p className="text-sm text-primary">{doctor.specialty}</p>
          </div>

          {booked ? (
            <>
              <div className="flex flex-col items-center text-center py-2">
                <CheckCircle2 size={44} className="text-green-600" />
                <p className="mt-3 text-sm text-gray-500">{t('your_serial')}</p>
                <p className="text-5xl font-bold text-primary leading-tight">#{booked.serial_no}</p>
                <p className="mt-1 text-sm text-gray-700">{t('arrive_around', { time: booked.estimated_arrival })}</p>
              </div>
              {details}
              <p className="text-xs text-gray-500 text-center">{t('arrival_estimate_note')}</p>
            </>
          ) : (
            <>
              {details}
              <div className="flex items-center gap-3 border border-primary/20 bg-primary/5 rounded-xl p-4">
                <Ticket size={22} className="text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-800">
                    {t('next_serial_is')} <span className="font-bold text-primary">#{session.nextSerial}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('arrive_around', { time: session.estimatedArrival })}</p>
                </div>
              </div>
              {doctor.fees != null && (
                <p className="text-sm text-gray-600">{t('fees')}: <span className="font-semibold text-gray-900">৳{doctor.fees}</span> <span className="text-gray-400">· {t('pay_at_chamber')}</span></p>
              )}
              {isPatient && (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">{t('reason_for_visit')} <span className="font-normal text-gray-400">({t('optional')})</span></span>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    maxLength={200}
                    rows={2}
                    placeholder={t('reason_placeholder')}
                    className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors"
                  />
                </label>
              )}
              {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </>
          )}
        </div>

        <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-black/5 flex flex-col gap-2">
          {booked ? (
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-3.5 text-sm font-medium text-gray-700">{t('done')}</button>
              <Link to="/appointments" className="flex-1 text-center bg-primary text-white rounded-xl py-3.5 text-sm font-semibold">{t('my_appointments')}</Link>
            </div>
          ) : isPatient ? (
            <button type="button" onClick={confirm} disabled={busy}
              className="w-full bg-primary text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
              {busy ? t('booking') : t('confirm_serial', { serial: session.nextSerial })}
            </button>
          ) : user ? (
            <p className="text-sm text-center text-gray-500 py-2">{t('patients_only')}</p>
          ) : (
            <Link to={loginHref} className="w-full text-center bg-primary text-white rounded-xl py-3.5 text-sm font-semibold">{t('login_to_book')}</Link>
          )}
          {!booked && <p className="text-xs text-center text-gray-400">{t('demo_booking_note')}</p>}
        </div>
      </div>
    </div>
  );
}
