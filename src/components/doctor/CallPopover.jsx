import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Phone } from 'lucide-react';
import { getDhakaNow, parseTimeRangeToMinutes } from '../../utils/dhakaTime';
import { api } from '../../api/client';

const POPOVER_WIDTH = 420;
const DAY_NAMES = { 6: 'Saturday', 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

function groupByVenue(schedule) {
  const map = new Map();
  for (const entry of schedule) {
    if (!map.has(entry.venue)) {
      map.set(entry.venue, { venue: entry.venue, phone: entry.phone, slots: [] });
    }
    map.get(entry.venue).slots.push({ time: entry.time, note: entry.note });
  }
  return [...map.values()];
}

export default function CallPopover({ doctor, schedule, dow, anchorEl, onClose }) {
  const popRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (popRef.current && !popRef.current.contains(e.target) && !anchorEl?.contains(e.target)) {
        onClose();
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, anchorEl]);

  const isFriday = dow === 5;
  const venues = !isFriday && schedule?.length ? groupByVenue(schedule) : [];

  const { dow: nowDow, minutes: nowMinutes } = getDhakaNow();
  const isToday = dow === nowDow;

  function isActiveVenue(venue) {
    if (!isToday) return false;
    return venue.slots.some(s => {
      const { start, end } = parseTimeRangeToMinutes(s.time);
      return start != null && end != null && nowMinutes >= start && nowMinutes < end;
    });
  }

  function callVenue(phone, venue) {
    // Fire-and-forget: records the tap, not confirmation a call was placed —
    // the web platform has no way to observe what happens after tel: hands
    // off to the OS dialer.
    api.post(`/doctors/${doctor.id}/call`, { venue: venue || null, phone: phone || doctor.phone }).catch(() => {});
    window.open(`tel:${phone || doctor.phone}`);
    onClose();
  }

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 glass-scrim" aria-hidden="true" />
      <div
        ref={popRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: POPOVER_WIDTH,
          maxWidth: 'calc(100vw - 32px)',
        }}
        className="z-50 glass-panel rounded-3xl p-6"
      >
        <p className="text-base font-semibold text-gray-800 mb-1">Call Chamber</p>
        <p className="text-xs text-gray-400 mb-4">{dow != null ? DAY_NAMES[dow] : ''}</p>

        {isFriday && (
          <div className="border border-gray-100 rounded-lg bg-gray-50/30 p-4 text-center text-sm text-gray-400">
            Doctor is off on Friday.
          </div>
        )}

        {!isFriday && venues.length === 0 && (
          <button onClick={() => callVenue(doctor.phone, doctor.name)}
            className="w-full flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 text-sm hover:border-primary hover:-translate-y-0.5 hover:shadow-sm transition-all">
            <Phone size={16} className="text-primary flex-shrink-0" />
            <span className="flex-1 text-left font-medium text-gray-700">{doctor.name}</span>
          </button>
        )}

        {!isFriday && venues.length > 0 && (
          <div className="flex flex-col gap-2">
            {venues.map(v => {
              const active = isActiveVenue(v);
              return (
                <button key={v.venue} onClick={() => callVenue(v.phone, v.venue)}
                  className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-sm text-left transition-all hover:-translate-y-0.5 hover:shadow-sm
                    ${active ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary'}`}>
                  <Phone size={16} className={active ? 'text-primary flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
                  <span className="flex-1 font-medium text-gray-700">{v.venue}</span>
                  {active && <span className="text-xs font-semibold text-primary uppercase tracking-wide flex-shrink-0">Now</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
