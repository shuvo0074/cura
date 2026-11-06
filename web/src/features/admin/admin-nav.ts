import type { TranslationKey } from '../../i18n';

/** Super admin sub-navigation: accounts and clinics first, then Cura Website content. */
export type AdminKey =
  | 'users'
  | 'owners'
  | 'clinics'
  | 'pharmacies'
  | 'verifications'
  | 'doctors'
  | 'hospitals'
  | 'ambulances'
  | 'specialties'
  | 'symptoms'
  | 'appointments'
  | 'samplePrices'
  | 'homePage'
  | 'siteText'
  | 'photoCredits';

export interface AdminItem {
  key: AdminKey;
  /** Words are in `i18n/areas/admin.ts`; show with `t(item.label)`. */
  label: TranslationKey;
  group: 'people' | 'directory' | 'content';
}

export const ADMIN_ITEMS: readonly AdminItem[] = [
  { key: 'users', label: 'admin.nav.users', group: 'people' },
  { key: 'owners', label: 'admin.nav.owners', group: 'people' },
  { key: 'clinics', label: 'admin.nav.clinics', group: 'people' },
  { key: 'pharmacies', label: 'admin.nav.pharmacies', group: 'people' },

  { key: 'verifications', label: 'admin.nav.verifications', group: 'directory' },
  { key: 'doctors', label: 'admin.nav.doctors', group: 'directory' },
  { key: 'hospitals', label: 'admin.nav.hospitals', group: 'directory' },
  { key: 'ambulances', label: 'admin.nav.ambulances', group: 'directory' },
  { key: 'specialties', label: 'admin.nav.specialties', group: 'directory' },
  { key: 'symptoms', label: 'admin.nav.symptoms', group: 'directory' },
  { key: 'appointments', label: 'admin.nav.appointments', group: 'directory' },

  { key: 'samplePrices', label: 'admin.nav.samplePrices', group: 'content' },
  { key: 'homePage', label: 'admin.nav.homePage', group: 'content' },
  { key: 'siteText', label: 'admin.nav.siteText', group: 'content' },
  { key: 'photoCredits', label: 'admin.nav.photoCredits', group: 'content' },
];
