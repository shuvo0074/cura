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
  label: string;
  group: 'people' | 'directory' | 'content';
}

export const ADMIN_ITEMS: readonly AdminItem[] = [
  { key: 'users', label: 'Users and roles', group: 'people' },
  { key: 'owners', label: 'New clinic', group: 'people' },
  { key: 'clinics', label: 'Clinics', group: 'people' },
  { key: 'pharmacies', label: 'Pharmacies', group: 'people' },

  { key: 'verifications', label: 'Doctor approvals', group: 'directory' },
  { key: 'doctors', label: 'Doctors', group: 'directory' },
  { key: 'hospitals', label: 'Hospitals and diagnostic centres', group: 'directory' },
  { key: 'ambulances', label: 'Ambulances', group: 'directory' },
  { key: 'specialties', label: 'Specialties', group: 'directory' },
  { key: 'symptoms', label: 'Symptoms', group: 'directory' },
  { key: 'appointments', label: 'Website bookings', group: 'directory' },

  { key: 'samplePrices', label: 'Sample prices', group: 'content' },
  { key: 'homePage', label: 'Home page', group: 'content' },
  { key: 'siteText', label: 'Site text', group: 'content' },
  { key: 'photoCredits', label: 'Photo credits', group: 'content' },
];
