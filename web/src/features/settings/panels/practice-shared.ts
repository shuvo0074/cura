/** Types and constants shared by the practice-details panel. */

import { formatTime, type Locale } from '../../../i18n';

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

/** Day indexes (0 = Sunday); each has a `settings.day.<n>` name. */
export const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

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
] as const;

/** 15-minute grid, which is what the session pickers offer in the reference UI. */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0');
  const m = String((i % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

export const label12h = (hhmm: string, locale: Locale = 'en') => {
  const [h, m] = hhmm.split(':').map(Number);
  // Bangla: a clock time with Bangla digits ("৯:৩০ AM").
  if (locale !== 'en') return formatTime(new Date(2000, 0, 1, h!, m!), locale);
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
};
