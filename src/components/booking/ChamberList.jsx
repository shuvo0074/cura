import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, LogIn, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { chamberTones, groupByVenue, hospitalIdFor } from './chambers';
import ChamberHeading from './ChamberHeading';
import { useAuth } from '../../context/AuthContext';
import { toYmd } from '../../utils/dates';

const FRIDAY = 5;

// Confirming one session: the reason for the visit, then the booking itself.
// Logged-out visitors go to login and come back to this doctor and date.
function BookingForm({ doctor, date, session, onBooked }) {
  const { t } = useTranslation();
  const { user, hasRole } = useAuth();
  const { pathname } = useLocation();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    const back = encodeURIComponent(`${pathname}?date=${date}#book-serial`);
    return (
      <Link to={`/login?redirect=${back}`}
        className="mt-2 flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
        <LogIn size={15} /> {t('login_to_book')}
      </Link>
    );
  }
  if (!hasRole('patient')) {
    return <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{t('patients_only')}</p>;
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const booked = await api.post('/appointments', {
        doctorId: doctor.id, date, venue: session.venue, session: session.time, notes: notes.trim() || undefined,
      });
      onBooked(booked);
    } catch (err) {
      setError(err.message);
      setBusy(false);
      // The next serial or the session's state may have changed meanwhile.
      onBooked(null);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-700">
        {t('reason_for_visit')} <span className="font-normal text-gray-400">({t('optional')})</span>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('reason_placeholder')}
          className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={busy}
        className="h-10 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-primary/90">
        {busy ? t('booking') : t('confirm_serial', { serial: session.nextSerial })}
      </button>
    </form>
  );
}

function BookedNotice({ booked }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="mt-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-gray-800">
      <p className="flex items-center gap-2 font-semibold text-green-800">
        <CheckCircle2 size={16} /> {t('serial_confirmed')}: #{booked.serial_no}
      </p>
      {booked.estimated_arrival && <p className="mt-1">{t('arrive_around', { time: booked.estimated_arrival })}</p>}
      <p className="text-xs text-gray-600 mt-1">{t('arrival_estimate_note')}</p>
      <Link to="/appointments" className="inline-block mt-2 text-sm font-semibold text-action hover:underline">{t('my_appointments')}</Link>
    </div>
  );
}

// The selected day's sessions grouped by chamber. Each session shows the serial
// the patient would get and books it online; a session that can't be booked
// says why, and one the patient already holds links to their list.
export default function ChamberList({ doctor, selectedDate, hospitalIds }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState(null);
  const [reloads, setReloads] = useState(0);
  const [picked, setPicked] = useState(null);
  const [booked, setBooked] = useState(null);
  const date = toYmd(selectedDate);
  const keyOf = s => `${s.venue}|${s.time}`;

  useEffect(() => {
    api.get(`/doctors/${doctor.id}/sessions?date=${date}`)
      .then(res => setSessions({ date, list: res.sessions }))
      .catch(() => setSessions({ date, list: [] }));
  }, [doctor.id, date, user?.id, reloads]);

  useEffect(() => { setPicked(null); setBooked(null); }, [date]);

  function handleBooked(appointment) {
    if (appointment) {
      setBooked({ key: picked, appointment });
      setPicked(null);
    }
    setReloads(n => n + 1);
  }

  const isFriday = selectedDate.getDay() === FRIDAY;
  const daySessions = sessions?.date === date ? sessions.list : null;
  const venues = !isFriday && daySessions ? groupByVenue(daySessions) : [];
  // Tones come from the weekly schedule so each chamber keeps the colour it has in the overview.
  const tones = chamberTones(doctor.weekly_schedule);
  const dayName = new Intl.DateTimeFormat(i18n.language === 'bn' ? 'bn-BD' : 'en-GB', { weekday: 'long' }).format(selectedDate);

  return (
    <div className="flex flex-col gap-3">
      {isFriday && (
        <p className="border border-gray-100 rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">{t('doctor_off_on', { day: dayName })}</p>
      )}

      {!isFriday && !daySessions && <p className="text-sm text-gray-400 text-center py-6">{t('loading')}</p>}

      {!isFriday && daySessions?.length === 0 && (
        <p className="border border-gray-100 rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">{t('no_sessions_day')}</p>
      )}

      {venues.map(v => (
        <div key={v.venue} className="relative overflow-hidden border border-gray-200 rounded-xl p-4 pl-5">
          <span className={`absolute inset-y-0 left-0 w-1 ${tones.get(v.venue)?.bar}`} aria-hidden="true" />
          <ChamberHeading chamber={v} tone={tones.get(v.venue)} hospitalId={hospitalIdFor(hospitalIds, v.venue)} />

          <div className="flex flex-col divide-y divide-gray-100 mt-3 pt-1 border-t border-gray-100">
            {v.sessions.map(s => {
              const key = keyOf({ venue: v.venue, time: s.time });
              const session = { ...s, venue: v.venue };
              return (
                <div key={s.time} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`min-w-0 ${!s.bookable && !s.mine ? 'opacity-60' : ''}`}>
                      <p className="text-sm font-medium text-gray-800 whitespace-nowrap">{s.time}</p>
                      {s.note && <p className="text-xs text-gray-500 truncate">{s.note}</p>}
                      {s.bookable && !s.mine && (
                        <p className="text-xs text-gray-500 mt-0.5">{t('next_serial_short', { serial: s.nextSerial, time: s.estimatedArrival })}</p>
                      )}
                      {!s.bookable && !s.mine && <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>}
                    </div>
                    {s.mine && (
                      <Link to="/appointments"
                        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                        <Ticket size={13} /> {t('your_serial_short', { serial: s.mine.serialNo })}
                      </Link>
                    )}
                    {s.bookable && !s.mine && (
                      <button type="button" onClick={() => setPicked(picked === key ? null : key)} aria-expanded={picked === key}
                        className="flex-shrink-0 h-9 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90">
                        {t('book_serial')}
                      </button>
                    )}
                  </div>
                  {picked === key && s.bookable && !s.mine && (
                    <BookingForm doctor={doctor} date={date} session={session} onBooked={handleBooked} />
                  )}
                  {booked?.key === key && <BookedNotice booked={booked.appointment} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
