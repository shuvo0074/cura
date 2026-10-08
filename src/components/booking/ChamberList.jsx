import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { groupByVenue, hospitalIdFor, isRemote } from './chambers';
import { useAuth } from '../../context/AuthContext';
import { toYmd } from '../../utils/dates';
import BookSerialSheet from './BookSerialSheet';

const FRIDAY = 5;

// Booking control for one session on the selected date.
function SessionAction({ session, onBook }) {
  const { t } = useTranslation();
  if (session.mine) {
    return (
      <Link to="/appointments"
        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
        <Ticket size={13} /> {t('your_serial_short', { serial: session.mine.serialNo })}
      </Link>
    );
  }
  if (!session.bookable) return null;
  return (
    <button type="button" onClick={() => onBook(session)}
      className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-white bg-primary rounded-full px-3.5 py-2 hover:bg-primary/90">
      <Ticket size={13} /> {t('book_serial')}
    </button>
  );
}

// The selected day's sessions grouped by chamber, each session with its
// serial-booking state (next serial, estimated arrival) and a Book action.
// Calling and directions live in ChamberOverview, so this stays about booking.
export default function ChamberList({ doctor, selectedDate, hospitalIds }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState(null);
  const [booking, setBooking] = useState(null);
  const date = toYmd(selectedDate);

  // Serial state depends on the date and on who's viewing (their own serials).
  const loadSessions = useCallback(() => {
    api.get(`/doctors/${doctor.id}/sessions?date=${date}`)
      .then(res => setSessions({ date, list: res.sessions }))
      .catch(() => setSessions({ date, list: [] }));
  }, [doctor.id, date]);
  useEffect(loadSessions, [loadSessions, user?.sub]);

  const isFriday = selectedDate.getDay() === FRIDAY;
  const daySessions = sessions?.date === date ? sessions.list : null;
  const venues = !isFriday && daySessions ? groupByVenue(daySessions) : [];
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

      {venues.map(v => {
        const hospitalId = hospitalIdFor(hospitalIds, v.venue);
        const remote = isRemote(v);
        return (
          <div key={v.venue} className="border border-gray-200 rounded-xl p-4">
            {hospitalId && !remote ? (
              <Link to={`/hospitals/${hospitalId}`} className="text-sm font-semibold text-gray-900 hover:text-primary">{v.venue}</Link>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                {remote && <Video size={14} className="text-primary" />}
                {remote ? t('phone_consultation') : v.venue}
              </p>
            )}
            {!remote && v.address && <p className="text-xs text-gray-500 mt-0.5">{v.address}</p>}

            <div className="flex flex-col divide-y divide-gray-100 mt-2">
              {v.sessions.map(s => (
                <div key={s.time} className="flex items-center justify-between gap-3 py-2.5">
                  <div className={`min-w-0 ${!s.bookable && !s.mine ? 'opacity-60' : ''}`}>
                    <p className="text-sm font-medium text-gray-800 whitespace-nowrap">{s.time}</p>
                    <p className="text-xs text-gray-500 truncate">{s.note}</p>
                    {s.bookable && !s.mine && (
                      <p className="text-xs text-primary font-medium mt-0.5">{t('next_serial_short', { serial: s.nextSerial, time: s.estimatedArrival })}</p>
                    )}
                    {!s.bookable && !s.mine && <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>}
                  </div>
                  <SessionAction session={s} onBook={setBooking} />
                </div>
              ))}
            </div>

          </div>
        );
      })}

      {booking && (
        <BookSerialSheet
          doctor={doctor}
          date={date}
          session={booking}
          onClose={() => setBooking(null)}
          onBooked={loadSessions}
        />
      )}
    </div>
  );
}
