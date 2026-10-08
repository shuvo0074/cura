import { Building2, Navigation, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDhakaNow, parseTimeRangeToMinutes } from '../../utils/dhakaTime';
import { callChamber, chamberTones, groupByVenue, hospitalIdFor, isRemote, openDirections } from './chambers';
import ChamberHeading from './ChamberHeading';

const FRIDAY = 5;

function isLive(time, now) {
  if (now.dow === FRIDAY) return false;
  const { start, end } = parseTimeRangeToMinutes(time);
  return start != null && end != null && now.minutes >= start && now.minutes < end;
}

const ACTION = 'flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors';

// Where and when the doctor sits, at a glance: one row per chamber (not per
// weekday — the pattern is the same Saturday to Thursday) with its session
// times, an "Open now" badge while a session is running in Dhaka, and the
// chamber's own Call and Directions. Booking a specific day lives in the
// booking card; this is the overview.
export default function ChamberOverview({ doctor, hospitalIds }) {
  const { t } = useTranslation();
  const schedule = doctor.weekly_schedule;
  if (!schedule?.length) return null;

  const now = getDhakaNow();
  const venues = groupByVenue(schedule);
  const tones = chamberTones(schedule);

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <Building2 size={18} className="text-primary" /> {t('chambers_hours')}
      </h2>
      <p className="text-xs text-gray-500 mt-1">{t('chambers_days')}</p>

      <ul className="mt-4 flex flex-col divide-y divide-gray-100">
        {venues.map(v => {
          const remote = isRemote(v);
          const hospitalId = !remote && hospitalIdFor(hospitalIds, v.venue);
          const open = v.sessions.some(s => isLive(s.time, now));
          return (
            <li key={v.venue} className="py-4 first:pt-0 last:pb-0">
              <ChamberHeading chamber={v} tone={tones.get(v.venue)} hospitalId={hospitalId}
                trailing={open && (
                  <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" /> {t('open_now')}
                  </span>
                )} />

              <div className="flex flex-wrap gap-1.5 mt-3 sm:pl-[52px]">
                {v.sessions.map(s => (
                  <span key={s.time} title={s.note}
                    className={`text-xs rounded-md px-2 py-1 whitespace-nowrap ${isLive(s.time, now) ? 'bg-green-50 text-green-800 font-medium' : 'bg-gray-50 text-gray-700'}`}>
                    {s.time}
                  </span>
                ))}
              </div>

              {(v.phone || !remote) && (
                <div className="flex gap-2 mt-3 sm:pl-[52px]">
                  {v.phone && (
                    <button type="button" onClick={() => callChamber(doctor.id, v.phone, v.venue)} className={ACTION}>
                      <Phone size={14} className="text-primary" /> {t('call')}
                    </button>
                  )}
                  {!remote && (
                    <button type="button" onClick={() => openDirections(v)} className={ACTION}>
                      <Navigation size={14} className="text-primary" /> {t('directions')}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
