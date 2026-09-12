import { Building2, Phone } from 'lucide-react';

const WORKING_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
const DAY_NAMES = { 6: 'Saturday', 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

function groupByVenue(schedule) {
  const map = new Map();
  for (const entry of schedule) {
    if (!map.has(entry.venue)) {
      map.set(entry.venue, { venue: entry.venue, address: entry.address, phone: entry.phone, slots: [] });
    }
    map.get(entry.venue).slots.push({ time: entry.time, note: entry.note });
  }
  return [...map.values()];
}

export default function ChamberList({ schedule, selectedDow }) {
  if (!schedule?.length) return null;

  const daySelected = selectedDow != null;
  const isFriday = selectedDow === 5;
  const venues = daySelected && !isFriday ? groupByVenue(schedule) : [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-[700px] flex flex-col">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0">
        <Building2 size={13} className="text-primary" /> Chamber List
      </p>
      {daySelected && (
        <p className="text-xs text-gray-400 mt-0.5 mb-3 flex-shrink-0">{DAY_NAMES[selectedDow]}</p>
      )}
      {!daySelected && <div className="mb-3" />}

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 -mr-1">
        {!daySelected && WORKING_DAYS.map(day => (
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

        {!daySelected && (
          <div className="border border-gray-100 rounded-lg bg-gray-50/30 p-3">
            <p className="text-xs font-semibold text-gray-400 mb-0.5">Fri</p>
            <p className="text-xs text-gray-400">Closed</p>
          </div>
        )}

        {daySelected && isFriday && (
          <div className="border border-gray-100 rounded-lg bg-gray-50/30 p-4 text-center text-sm text-gray-400">
            Doctor is off on {DAY_NAMES[selectedDow]}.
          </div>
        )}

        {daySelected && !isFriday && venues.map(v => (
          <div key={v.venue} className="border border-gray-100 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-800">{v.venue}</p>
            {v.address && <p className="text-xs text-gray-500 mt-0.5">{v.address}</p>}
            <div className="flex flex-col gap-1 mt-2.5">
              {v.slots.map(s => (
                <div key={s.time} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">{s.time}</span>
                  <span className="text-gray-400">{s.note}</span>
                </div>
              ))}
            </div>
            {v.phone && (
              <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2.5 pt-2.5 border-t border-gray-100">
                <Phone size={11} className="text-primary" /> {v.phone}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
