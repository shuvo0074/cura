import { Baby, Bone, Ear, Eye, HeartPulse, Sparkles, Stethoscope, Venus } from 'lucide-react';

// Icons for the home page's popular specialties, by specialty page. The
// picks and their labels are edited in the admin panel (Home page tab);
// other specialties show their own emoji icon.
export const SPECIALTY_ICONS = {
  'general-physician': Stethoscope, gynecology: Venus, pediatrics: Baby, cardiology: HeartPulse,
  dermatology: Sparkles, ent: Ear, ophthalmology: Eye, orthopaedics: Bone,
};

// Show the label in the UI language, with the other language as a hint.
export const labelFor = (item, lang) => (lang === 'bn' ? item.bn : item.en);
export const altLabelFor = (item, lang) => (lang === 'bn' ? item.en : item.bn);

export function formatNumber(n, lang) {
  return new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US').format(n);
}
