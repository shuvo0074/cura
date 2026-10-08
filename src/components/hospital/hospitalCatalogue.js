import {
  Siren, Ambulance, BedDouble, HeartPulse, Baby, Scissors, Droplet,
  FlaskConical, House, ScanLine, ScanSearch, Magnet, Activity,
  Stethoscope, PersonStanding, Syringe, Pill,
  SquareParking, Moon, Coffee, Banknote, ArrowUpDown, UserRound, Sofa, Accessibility,
} from 'lucide-react';

// Icons and label keys for the codes stored on a hospital (see schema.sql:
// services, facilities, payment_methods). Unknown codes are skipped, so new
// ones can be added to the data before the app learns about them.

export const SERVICE_GROUPS = [
  { key: 'critical', services: ['emergency', 'ambulance', 'icu', 'ccu', 'nicu', 'operation_theatre', 'blood_bank'] },
  { key: 'diagnostics', services: ['lab', 'home_sample', 'xray', 'ultrasound', 'ct_scan', 'mri', 'ecg_echo'] },
  { key: 'care', services: ['maternity', 'dialysis', 'physiotherapy', 'vaccination', 'pharmacy'] },
];

export const SERVICE_ICONS = {
  emergency: Siren, ambulance: Ambulance, icu: BedDouble, ccu: HeartPulse, nicu: Baby,
  operation_theatre: Scissors, blood_bank: Droplet,
  lab: FlaskConical, home_sample: House, xray: ScanLine, ultrasound: ScanSearch, ct_scan: ScanSearch,
  mri: Magnet, ecg_echo: Activity,
  maternity: Stethoscope, dialysis: Activity, physiotherapy: PersonStanding, vaccination: Syringe, pharmacy: Pill,
};

export const FACILITY_ICONS = {
  parking: SquareParking, prayer_room: Moon, cafeteria: Coffee, atm: Banknote, lift: ArrowUpDown,
  female_staff: UserRound, waiting_area: Sofa, wheelchair: Accessibility,
};

export const TEST_CATEGORIES = ['blood', 'imaging', 'cardiac'];

export const is24x7 = hours => hours === '24/7';
