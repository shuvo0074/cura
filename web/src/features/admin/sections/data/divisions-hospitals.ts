import type { TranslationKey, UseT } from '../../../../i18n';

/** Bangladesh divisions and their districts, copied from Cura Website (divisions.json, divisionCities.json). */

export const DIVISIONS: readonly string[] = [
  'Barishal',
  'Chattogram',
  'Dhaka',
  'Khulna',
  'Mymensingh',
  'Rajshahi',
  'Rangpur',
  'Sylhet',
];

export const DIVISION_DISTRICTS: Readonly<Record<string, readonly string[]>> = {
  Barishal: ['Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
  Chattogram: [
    'Bandarban',
    'Brahmanbaria',
    'Chandpur',
    'Chattogram',
    'Comilla',
    "Cox's Bazar",
    'Feni',
    'Khagrachhari',
    'Lakshmipur',
    'Noakhali',
    'Rangamati',
  ],
  Dhaka: [
    'Dhaka',
    'Faridpur',
    'Gazipur',
    'Gopalganj',
    'Kishoreganj',
    'Madaripur',
    'Manikganj',
    'Munshiganj',
    'Narayanganj',
    'Narsingdi',
    'Rajbari',
    'Shariatpur',
    'Tangail',
  ],
  Khulna: [
    'Bagerhat',
    'Chuadanga',
    'Jashore',
    'Jhenaidah',
    'Khulna',
    'Kushtia',
    'Magura',
    'Meherpur',
    'Narail',
    'Satkhira',
  ],
  Mymensingh: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
  Rajshahi: ['Bogura', 'Chapai Nawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'],
  Rangpur: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
  Sylhet: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
};

/** Districts of the chosen divisions, or of all divisions when none is chosen, sorted. */
export function districtsFor(divisions: readonly string[]): string[] {
  const list = divisions.length ? divisions : DIVISIONS;
  return list.flatMap((division) => DIVISION_DISTRICTS[division] ?? []).sort((a, b) => a.localeCompare(b));
}

/** A division's name in the current language (`admin.division.*`). Values stay in English. */
export const divisionLabel = (t: UseT['t'], name: string): string =>
  DIVISIONS.includes(name) ? t(`admin.division.${name}` as TranslationKey) : name;

/** A district's name in the current language (`admin.district.*`). Values stay in English. */
export const districtLabel = (t: UseT['t'], name: string): string =>
  Object.values(DIVISION_DISTRICTS).some((list) => list.includes(name))
    ? t(`admin.district.${name}` as TranslationKey)
    : name;
