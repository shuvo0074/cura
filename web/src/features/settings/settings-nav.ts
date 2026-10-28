/**
 * Settings sub-navigation (spec: "Settings Module" — secondary sidebar).
 *
 * The order and grouping mirror the spec's list rather than alphabetising:
 * doctors learn a settings screen by muscle memory, so a stable, predictable
 * position matters more than tidiness.
 */
export type SettingsKey =
  | 'premium'
  | 'practice'
  | 'staff'
  | 'calendar'
  | 'communications'
  | 'pricing'
  | 'consent'
  | 'security'
  | 'notes'
  | 'drugs'
  | 'charting'
  | 'printouts'
  | 'email';

export interface SettingsItem {
  key: SettingsKey;
  label: string;
  /** Groups are separated by a rule in the sidebar, matching the spec's blocks. */
  group: 'practice' | 'clinical' | 'output';
}

export const SETTINGS_ITEMS: readonly SettingsItem[] = [
  { key: 'premium', label: 'Premium', group: 'practice' },
  { key: 'practice', label: 'Practice Details', group: 'practice' },
  { key: 'staff', label: 'Practice Staff', group: 'practice' },
  { key: 'calendar', label: 'Calendar', group: 'practice' },
  { key: 'communications', label: 'Communications', group: 'practice' },
  { key: 'pricing', label: 'Pricing Catalog', group: 'practice' },
  { key: 'consent', label: 'Consent Forms', group: 'practice' },
  { key: 'security', label: 'Data Security', group: 'practice' },

  { key: 'notes', label: 'Clinical Notes Catalog', group: 'clinical' },
  { key: 'drugs', label: 'Drug Catalog', group: 'clinical' },
  { key: 'charting', label: 'Charting Templates', group: 'clinical' },

  { key: 'printouts', label: 'Printouts', group: 'output' },
  { key: 'email', label: 'Emails', group: 'output' },
];
