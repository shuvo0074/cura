/** Shapes the super admin API returns. */

export type ClinicRole = 'ADMINISTRATOR' | 'DOCTOR' | 'DESK_STAFF';
export type GrantableRole = 'super_admin' | 'patient' | 'ambulance_owner' | 'pharmacy_owner';

export interface AdminUser {
  id: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
  clinic_role: ClinicRole | null;
  roles: string[];
  clinics: { id: string; name: string; role: ClinicRole; is_active: boolean }[];
  is_active: boolean;
  has_login: boolean;
  doctor?: { id: string; specialty: string; hidden: boolean; pending_approval: boolean } | null;
  ambulances?: { id: string; name: string }[];
  pharmacies?: { id: string; name: string }[];
}

export interface AdminClinic {
  id: string;
  name: string;
  specialization: string | null;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  is_active: boolean;
  staff_count: number;
  patient_count: number;
}

export const CLINIC_ROLE_LABELS: Record<ClinicRole, string> = {
  ADMINISTRATOR: 'Clinic owner',
  DOCTOR: 'Doctor',
  DESK_STAFF: 'Clinic staff',
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  patient: 'Patient',
  doctor: 'Doctor (Cura Website)',
  ambulance_owner: 'Ambulance owner',
  pharmacy_owner: 'Pharmacy owner',
};

export const GRANTABLE_ROLES: readonly GrantableRole[] = ['super_admin', 'patient', 'ambulance_owner', 'pharmacy_owner'];

/** The clinic a super admin is looking at, read-only. */
export interface ViewedClinic {
  id: string;
  name: string;
}
