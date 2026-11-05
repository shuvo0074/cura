// Doctors sign up on Cura Dashboard. Patients use this site.
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'https://cura-web-qvfx.onrender.com';

export const doctorRegisterUrl = () => `${DASHBOARD_URL}/?tab=register`;

// Opens the pre-filled sign-up for a doctor an admin already added.
export const doctorClaimUrl = phone => `${DASHBOARD_URL}/?claim=${encodeURIComponent(phone)}`;
