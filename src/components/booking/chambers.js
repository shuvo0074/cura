import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// Helpers shared by the doctor profile's chamber overview and booking list.

// Sessions (or weekly_schedule entries) grouped by venue, in first-seen order.
export function groupByVenue(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.venue)) map.set(s.venue, { venue: s.venue, address: s.address, phone: s.phone, sessions: [] });
    map.get(s.venue).sessions.push(s);
  }
  return [...map.values()];
}

// Phone/online consultations are listed among the chambers but have no place
// to visit, so they get a label instead of an address and no Directions.
export function isRemote(v) {
  return /telemedicine|online/i.test(`${v.venue} ${v.address || ''}`);
}

export function openDirections(v) {
  const query = [v.venue, v.address].filter(Boolean).join(', ');
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
}

// Fire-and-forget: records the tap, not confirmation a call was placed — the
// web platform has no way to observe what happens after tel: hands off to the OS.
export function callChamber(doctorId, phone, venue) {
  api.post(`/doctors/${doctorId}/call`, { venue: venue || null, phone }).catch(() => {});
  window.open(`tel:${phone}`);
}

// Chamber venues are plain name strings (see §7's weekly_schedule shape), not
// hospital foreign keys — not every venue is a real hospital row (e.g.
// "Telemedicine", or the original 6 doctors' fictional standalone clinics),
// so this is a best-effort name match, not a guaranteed link.
export function useHospitalIdByName() {
  const [map, setMap] = useState({});
  useEffect(() => {
    api.get('/hospitals').then(hospitals => {
      const next = {};
      for (const h of hospitals) next[h.name.trim().toLowerCase()] = h.id;
      setMap(next);
    }).catch(() => {});
  }, []);
  return map;
}

// Whether a schedule entry can be booked online: it needs a chamber and a
// session time the API can read, like "08:00 AM - 11:00 AM".
const SESSION_TIME = /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i;
export function hasBookableSessions(schedule) {
  return (schedule ?? []).some(entry => entry.venue && SESSION_TIME.test(entry.time ?? ''));
}

export function hospitalIdFor(map, venue) {
  return map[venue.trim().toLowerCase()];
}

// One colour per chamber so the same chamber is easy to spot in both the
// overview and the booking list. Assigned in weekly_schedule order, so it's
// stable for a doctor; phone consultations always get their own tone.
const TONES = [
  { tile: 'bg-primary text-white', bar: 'bg-primary' },
  { tile: 'bg-teal-600 text-white', bar: 'bg-teal-600' },
  { tile: 'bg-violet-600 text-white', bar: 'bg-violet-600' },
  { tile: 'bg-amber-500 text-white', bar: 'bg-amber-500' },
];
const REMOTE_TONE = { tile: 'bg-sky-500 text-white', bar: 'bg-sky-500' };

export function chamberTones(schedule) {
  const tones = new Map();
  let next = 0;
  for (const v of groupByVenue(schedule ?? [])) {
    tones.set(v.venue, isRemote(v) ? REMOTE_TONE : TONES[next++ % TONES.length]);
  }
  return tones;
}
