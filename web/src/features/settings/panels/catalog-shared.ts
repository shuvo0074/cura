/** Types and constants shared by the catalog settings panels. */

/** Pricing, clinical notes, drugs, charting templates and consent forms. */

// -- Pricing ----------------------------------------------------------------

export interface PricingItem {
  id: string;
  name: string;
  priceMinor: number;
  notes: string | null;
  isDefault: boolean;
}

/** Spec: Pricing Catalog → "Default Treatment List", offered when the catalog is bare. */
export const DEFAULT_TREATMENTS = ['Consultation', 'Consultation by Video Call', 'Follow-up Visit'];

// -- Clinical notes catalog -------------------------------------------------

export const NOTE_KINDS = [
  { key: 'COMPLAINT', label: 'Complaints' },
  { key: 'OBSERVATION', label: 'Observations' },
  { key: 'DIAGNOSIS', label: 'Diagnoses' },
  { key: 'ADVICE', label: 'Advice' },
  { key: 'NOTE', label: 'Notes' },
] as const;

// -- Drug catalog -----------------------------------------------------------

export interface Drug {
  id: string;
  name: string;
  form: string | null;
  strength: string | null;
  unit: string | null;
  instruction: string | null;
}

export const DRUG_FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROP', 'OINTMENT', 'INHALER', 'GARGLE', 'SUPPOSITORY'];
export const DRUG_UNITS = ['mg', 'ml', 'mcg', 'g', 'IU', '%'];

// -- Charting templates -----------------------------------------------------

export interface ChartingTemplate {
  id: string;
  name: string;
  diagnoses: string[];
  labOrders: string[];
  followUpDays: number | null;
}

// -- Consent forms ----------------------------------------------------------

export interface ConsentForm {
  id: string;
  title: string;
  bodyHtml: string;
  isActive: boolean;
}

// -- Shared -----------------------------------------------------------------
