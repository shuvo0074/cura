import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, Phone, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { toYmd } from '../../utils/dates';
import BookSerialSheet from './BookSerialSheet';

const WORKING_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
const DAY_NAMES = { 6: 'Saturday', 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

function groupByVenue(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.venue)) map.set(s.venue, { venue: s.venue, address: s.address, phone: s.phone, sessions: [] });
    map.get(s.venue).sessions.push(s);
  }
  return [...map.values()];
}

// Booking control for one session on the selected date.
function SessionAction({ session, onBook }) {
  const { t } = useTranslation();
  if (session.mine) {
    return (
      <Link to="/appointments" onClick={e => e.stopPropagation()}
        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
        <Ticket size={13} /> {t('your_serial_short', { serial: session.mine.serialNo })}
      </Link>
    );
  }
  if (!session.bookable) return <span className="flex-shrink-0 text-xs text-gray-400">{session.reason}</span>;
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onBook(session); }}
      className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-white bg-primary rounded-full px-3.5 py-2 hover:bg-primary/90">
      <Ticket size={13} /> {t('book_serial')}
    </button>
  );
}

// Doctor's chambers. With no date selected: the weekly pattern. With a date:
// that day's sessions grouped by venue, each with its serial-booking state
// (next serial and estimated arrival) and a "Book serial" action.
export default function ChamberList({ doctor, selectedDate }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hospitalIdByName, setHospitalIdByName] = useState({});
  const [sessions, setSessions] = useState(null);
  const [booking, setBooking] = useState(null);
  const schedule = doctor.weekly_schedule;
  const date = selectedDate ? toYmd(selectedDate) : null;

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
    if (!date) return;
    api.get(`/doctors/${doctor.id}/sessions?date=${date}`)
      .then(res => setSessions({ date, list: res.sessions }))
      .catch(() => setSessions({ date, list: [] }));
  }, [doctor.id, date]);
  useEffect(loadSessions, [loadSessions, user?.sub]);

  if (!schedule?.length) return null;

  function callVenue(e, phone, venue) {
    e.stopPropagation();
    // Fire-and-forget: mirrors CallPopover's call-intent log — records the
    // tap, not confirmation a call was placed (the web platform has no way
    // to observe what happens after tel: hands off to the OS).
    api.post(`/doctors/${doctor.id}/call`, { venue: venue || null, phone }).catch(() => {});
    window.open(`tel:${phone}`);
  }

  const selectedDow = selectedDate ? selectedDate.getDay() : null;
  const isFriday = selectedDow === 5;
  const daySessions = sessions?.date === date ? sessions.list : null;
  const venues = date && !isFriday && daySessions ? groupByVenue(daySessions) : [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6 lg:h-[700px] flex flex-col">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0">
        <Building2 size={13} className="text-primary" /> {t('chamber_list')}
      </p>
      {date ? (
        <p className="text-xs text-gray-400 mt-0.5 mb-3 flex-shrink-0">{DAY_NAMES[selectedDow]}</p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 rounded-lg px-3 py-2 mt-2 mb-3 flex-shrink-0">
          <CalendarDays size={13} /> {t('pick_date_to_book')}
        </p>
      )}

      <div className="flex-1 lg:overflow-y-auto flex flex-col gap-3 lg:pr-1 lg:-mr-1">
        {!date && WORKING_DAYS.map(day => (
          <div key={day} className="border border-gray-100 rounded-lg bg-gray-50/50 p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">{day}</p>
            <div className="flex flex-col gap-1.5">
              {schedule.map((entry, i) => (
                <div key={i} className="flex items-baseline gap-2 text-xs leading-snug">
                  <span className="text-gray-700 font-medium whitespace-nowrap flex-shrink-0">{entry.time}</span>
                  <span className="text-gray-300">—</span>
                  <span className="text-gray-500 truncate">{entry.venue} — {entry.note}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!date && (
          <div className="border border-gray-100 rounded-lg bg-gray-50/30 p-3">
            <p className="text-xs font-semibold text-gray-400 mb-0.5">Fri</p>
            <p className="text-xs text-gray-400">Closed</p>
          </div>
        )}

        {date && isFriday && (
          <div className="border border-gray-100 rounded-lg bg-gray-50/30 p-4 text-center text-sm text-gray-400">
            Doctor is off on {DAY_NAMES[selectedDow]}.
          </div>
        )}

        {date && !isFriday && !daySessions && (
          <p className="text-sm text-gray-400 text-center py-6">{t('loading')}</p>
        )}

        {venues.map(v => {
          const hospitalId = hospitalIdByName[v.venue.trim().toLowerCase()];
          return (
            <div key={v.venue} className="border border-gray-100 rounded-lg p-4">
              <button type="button" disabled={!hospitalId} onClick={() => navigate(`/hospitals/${hospitalId}`)}
                className="text-left text-sm font-semibold text-gray-800 enabled:hover:text-primary">
                {v.venue}
              </button>
              {v.address && <p className="text-xs text-gray-500 mt-0.5">{v.address}</p>}
              <div className="flex flex-col divide-y divide-gray-100 mt-2">
                {v.sessions.map(s => (
                  <div key={s.time} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{s.time}</p>
                      <p className="text-xs text-gray-500 truncate">{s.note}</p>
                      {s.bookable && !s.mine && (
                        <p className="text-xs text-primary font-medium mt-0.5">{t('next_serial_short', { serial: s.nextSerial, time: s.estimatedArrival })}</p>
                      )}
                    </div>
                    <SessionAction session={s} onBook={setBooking} />
                  </div>
                ))}
              </div>
              {v.phone && (
                <button onClick={(e) => callVenue(e, v.phone, v.venue)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 mt-1 pt-2.5 border-t border-gray-100 w-full hover:text-primary transition-colors">
                  <Phone size={11} className="text-primary" /> {v.phone}
                </button>
              )}
            </div>
          );
        })}
      </div>

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
