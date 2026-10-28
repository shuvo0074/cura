import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { callChamber, chamberTones, groupByVenue, hospitalIdFor } from './chambers';
import ChamberHeading from './ChamberHeading';
import { useAuth } from '../../context/AuthContext';
import { toYmd } from '../../utils/dates';

const FRIDAY = 5;

// The selected day's sessions grouped by chamber, with one "Call for
// booking" per chamber: serials are booked by phoning the chamber. A serial
// the patient already booked online still shows, linking to their list.
export default function ChamberList({ doctor, selectedDate, hospitalIds }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState(null);
  const date = toYmd(selectedDate);

  // Which sessions are on, ended or closed that day (and the viewer's own serials).
  useEffect(() => {
    api.get(`/doctors/${doctor.id}/sessions?date=${date}`)
      .then(res => setSessions({ date, list: res.sessions }))
      .catch(() => setSessions({ date, list: [] }));
  }, [doctor.id, date, user?.id]);

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

      {venues.map(v => {
        const hospitalId = hospitalIdFor(hospitalIds, v.venue);
        return (
          <div key={v.venue} className="relative overflow-hidden border border-gray-200 rounded-xl p-4 pl-5">
            <span className={`absolute inset-y-0 left-0 w-1 ${tones.get(v.venue)?.bar}`} aria-hidden="true" />
            <ChamberHeading chamber={v} tone={tones.get(v.venue)} hospitalId={hospitalId} />

            <div className="flex flex-col divide-y divide-gray-100 mt-3 pt-1 border-t border-gray-100">
              {v.sessions.map(s => (
                <div key={s.time} className="flex items-center justify-between gap-3 py-2.5">
                  <div className={`min-w-0 ${!s.bookable && !s.mine ? 'opacity-60' : ''}`}>
                    <p className="text-sm font-medium text-gray-800 whitespace-nowrap">{s.time}</p>
                    <p className="text-xs text-gray-500 truncate">{s.note}</p>
                    {!s.bookable && !s.mine && <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>}
                  </div>
                  {s.mine && (
                    <Link to="/appointments"
                      className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                      <Ticket size={13} /> {t('your_serial_short', { serial: s.mine.serialNo })}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {v.phone && v.sessions.some(s => s.bookable) && (
              <button type="button" onClick={() => callChamber(doctor.id, v.phone, v.venue)}
                className="mt-2 w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
                <Phone size={15} /> {t('call_for_booking')}
              </button>
            )}

          </div>
        );
      })}
    </div>
  );
}
