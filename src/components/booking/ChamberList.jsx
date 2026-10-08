import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, Phone, Ticket, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { toYmd } from '../../utils/dates';
import BookSerialSheet from './BookSerialSheet';

const FRIDAY = 5;

function groupByVenue(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.venue)) map.set(s.venue, { venue: s.venue, address: s.address, phone: s.phone, sessions: [] });
    map.get(s.venue).sessions.push(s);
  }
  return [...map.values()];
}

// Phone/online consultations are listed among the chambers but have no place
// to visit, so they get a label instead of an address and no Directions.
function isRemote(v) {
  return /telemedicine|online/i.test(`${v.venue} ${v.address || ''}`);
}

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

const ACTION = 'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors';

// The selected day's sessions grouped by chamber, each session with its
// serial-booking state (next serial, estimated arrival) and a Book action,
// and each chamber with its own Call and Directions.
export default function ChamberList({ doctor, selectedDate }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [hospitalIdByName, setHospitalIdByName] = useState({});
  const [sessions, setSessions] = useState(null);
  const [booking, setBooking] = useState(null);
  const date = toYmd(selectedDate);

  useEffect(() => {
    // Chamber venues are plain name strings (see §7's weekly_schedule shape),
    // not hospital foreign keys — not every venue is a real hospital row
    // (e.g. "Telemedicine", or the original 6 doctors' fictional standalone
    // clinics), so this is a best-effort name match, not a guaranteed link.
    api.get('/hospitals').then(hospitals => {
      const map = {};
      for (const h of hospitals) map[h.name.trim().toLowerCase()] = h.id;
      setHospitalIdByName(map);
    }).catch(() => {});
  }, []);

  // Serial state depends on the date and on who's viewing (their own serials).
  const loadSessions = useCallback(() => {
    api.get(`/doctors/${doctor.id}/sessions?date=${date}`)
      .then(res => setSessions({ date, list: res.sessions }))
      .catch(() => setSessions({ date, list: [] }));
  }, [doctor.id, date]);
  useEffect(loadSessions, [loadSessions, user?.sub]);

  function callVenue(phone, venue) {
    // Fire-and-forget: mirrors CallPopover's call-intent log — records the
    // tap, not confirmation a call was placed (the web platform has no way
    // to observe what happens after tel: hands off to the OS).
    api.post(`/doctors/${doctor.id}/call`, { venue: venue || null, phone }).catch(() => {});
    window.open(`tel:${phone}`);
  }

  function directionsTo(v) {
    const query = [v.venue, v.address].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  }

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
        const hospitalId = hospitalIdByName[v.venue.trim().toLowerCase()];
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

            {(v.phone || !remote) && (
              <div className="flex gap-2 mt-1 pt-3 border-t border-gray-100">
                {v.phone && (
                  <button type="button" onClick={() => callVenue(v.phone, v.venue)} className={ACTION}>
                    <Phone size={14} className="text-primary" /> {t('call')}
                  </button>
                )}
                {!remote && (
                  <button type="button" onClick={() => directionsTo(v)} className={ACTION}>
                    <Navigation size={14} className="text-primary" /> {t('directions')}
                  </button>
                )}
              </div>
            )}
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
