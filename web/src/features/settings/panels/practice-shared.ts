/** Types and constants shared by the practice-details panel. */

export interface Session {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Practice {
  name: string;
  specialization: string | null;
  binNumber: string | null;
  contactNumber: string | null;
  email: string | null;
  website: string | null;
  addressLine1: string | null;
  locality: string | null;
  city: string | null;
  country: string;
  postCode: string | null;
  address: string | null;
  mapsUrl: string | null;
  roomNumber: string | null;
  logoUrl: string | null;
  sessions: Session[];
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Spec: Practice Details → "Specialization: a dropdown or search-suggest field". */
export const SPECIALIZATIONS = [
  'General Practice',
  'Medicine',
  'Cardiology',
  'Dermatology',
  'Dentistry',
  'ENT',
  'Gastroenterology',
  'Gynaecology & Obstetrics',
  'Neurology',
  'Orthopaedics',
  'Paediatrics',
  'Psychiatry',
  'Urology',
];

/** 15-minute grid, which is what the session pickers offer in the reference UI. */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0');
  const m = String((i % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

export const label12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
};
