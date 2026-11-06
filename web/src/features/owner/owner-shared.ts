/** Types and helpers shared by the ambulance and pharmacy owner screens. */

export const AMBULANCE_TYPES = [
  { key: 'ac', label: 'AC' },
  { key: 'non_ac', label: 'Non-AC' },
  { key: 'freezer', label: 'Freezer' },
  { key: 'icu', label: 'ICU' },
] as const;

export const AMBULANCE_SERVICES = [
  { key: '24_hours', label: '24 hours' },
  { key: 'oxygen', label: 'Oxygen' },
  { key: 'medical_team', label: 'Medical team' },
  { key: 'interdistrict', label: 'Travels between districts' },
] as const;

export type FareRange = { min: number | string; max: number | string };

export interface AmbulanceVendor {
  id: string;
  name: string;
  address: string | null;
  phones: string[];
  categories: string[];
  features: string[];
  dhaka_wide: boolean;
  fares: Record<string, FareRange>;
  hidden: boolean;
}

export interface Pharmacy {
  id: string;
  name: string;
  license_number: string | null;
  address: string | null;
  city: string | null;
  phones: string[];
  opening_hours: string | null;
  home_delivery: boolean;
  hidden: boolean;
}

export const toggled = (list: readonly string[], key: string, on: boolean): string[] =>
  on ? [...list, key] : list.filter((item) => item !== key);
