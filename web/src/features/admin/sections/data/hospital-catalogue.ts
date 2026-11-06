import type { TranslationKey, UseT } from '../../../../i18n';

/**
 * Codes stored on a hospital or diagnostic centre, with English labels.
 * Show a label with `catalogueLabel(t, kind, key)`: the words are in
 * `i18n/areas/admin.ts` under `catalogue.*`.
 * Copied from Cura Website (hospitalCatalogue.js and its en.json labels);
 * the API checks `type` and test categories against the same lists.
 */

export interface Option {
  key: string;
  label: string;
}

export const HOSPITAL_TYPES: readonly Option[] = [
  { key: 'hospital', label: 'Hospital' },
  { key: 'diagnostic', label: 'Diagnostic centre' },
  { key: 'clinic', label: 'Clinic' },
  { key: 'online', label: 'Online' },
];

export const SERVICE_GROUPS: readonly { key: string; label: string; services: readonly Option[] }[] = [
  {
    key: 'critical',
    label: 'Emergency and critical care',
    services: [
      { key: 'emergency', label: 'Emergency' },
      { key: 'ambulance', label: 'Ambulance' },
      { key: 'icu', label: 'ICU' },
      { key: 'ccu', label: 'CCU (cardiac care)' },
      { key: 'nicu', label: 'NICU (newborn care)' },
      { key: 'operation_theatre', label: 'Operation theatre' },
      { key: 'blood_bank', label: 'Blood bank' },
    ],
  },
  {
    key: 'diagnostics',
    label: 'Tests and scans',
    services: [
      { key: 'lab', label: 'Pathology lab' },
      { key: 'home_sample', label: 'Home sample collection' },
      { key: 'xray', label: 'X-ray' },
      { key: 'ultrasound', label: 'Ultrasound' },
      { key: 'ct_scan', label: 'CT scan' },
      { key: 'mri', label: 'MRI' },
      { key: 'ecg_echo', label: 'ECG and echo' },
    ],
  },
  {
    key: 'care',
    label: 'Treatment and care',
    services: [
      { key: 'maternity', label: 'Maternity and delivery' },
      { key: 'dialysis', label: 'Dialysis' },
      { key: 'physiotherapy', label: 'Physiotherapy' },
      { key: 'vaccination', label: 'Vaccination' },
      { key: 'pharmacy', label: 'Pharmacy' },
    ],
  },
];

export const FACILITIES: readonly Option[] = [
  { key: 'parking', label: 'Parking' },
  { key: 'prayer_room', label: 'Prayer room' },
  { key: 'cafeteria', label: 'Cafeteria' },
  { key: 'atm', label: 'ATM' },
  { key: 'lift', label: 'Lift' },
  { key: 'female_staff', label: 'Female staff' },
  { key: 'waiting_area', label: 'Waiting area' },
  { key: 'wheelchair', label: 'Wheelchair access' },
];

export const PAYMENT_METHODS: readonly Option[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'bkash', label: 'bKash' },
  { key: 'nagad', label: 'Nagad' },
  { key: 'card', label: 'Card' },
  { key: 'insurance', label: 'Insurance' },
];

export const TEST_CATEGORIES: readonly Option[] = [
  { key: 'blood', label: 'Blood and urine' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'cardiac', label: 'Heart' },
];

/** Suggestions for the test name box; any name can still be typed. */
export const COMMON_TESTS: readonly string[] = [
  'Complete Blood Count (CBC)',
  'Random Blood Sugar (RBS)',
  'HbA1c',
  'Lipid Profile',
  'Thyroid (TSH)',
  'Serum Creatinine',
  'Urine Routine Examination',
  'Dengue NS1 Antigen',
  'X-ray Chest (PA view)',
  'Ultrasound Whole Abdomen',
  'CT Scan Brain',
  'MRI Brain',
  'ECG',
  'Echocardiogram',
];

/** Hours text meaning "always open". */
export const ALL_DAY = '24/7';

export type CatalogueKind = 'type' | 'group' | 'service' | 'facility' | 'payment' | 'testCategory';

const CATALOGUE: Record<CatalogueKind, readonly Option[]> = {
  type: HOSPITAL_TYPES,
  group: SERVICE_GROUPS,
  service: SERVICE_GROUPS.flatMap((group) => group.services),
  facility: FACILITIES,
  payment: PAYMENT_METHODS,
  testCategory: TEST_CATEGORIES,
};

/** A catalogue code's label in the current language; an unknown code is shown as it is. */
export const catalogueLabel = (t: UseT['t'], kind: CatalogueKind, key: string): string =>
  CATALOGUE[kind].some((option) => option.key === key) ? t(`admin.catalogue.${kind}.${key}` as TranslationKey) : key;

export const typeLabel = (t: UseT['t'], key: string | null | undefined): string =>
  key && HOSPITAL_TYPES.some((type) => type.key === key) ? catalogueLabel(t, 'type', key) : t('admin.catalogue.notSet');
