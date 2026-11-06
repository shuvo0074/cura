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

/** Each kind has `settings.notes.kind.*`, `.search.*`, `.searchLabel.*`, `.new.*` and `.empty.*` words. */
export const NOTE_KINDS = ['COMPLAINT', 'OBSERVATION', 'DIAGNOSIS', 'ADVICE', 'NOTE'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

// -- Drug catalog -----------------------------------------------------------

export interface Drug {
  id: string;
  name: string;
  form: string | null;
  strength: string | null;
  unit: string | null;
  instruction: string | null;
}

export const DRUG_FORMS = [
  'TABLET',
  'CAPSULE',
  'SYRUP',
  'INJECTION',
  'DROP',
  'OINTMENT',
  'INHALER',
  'GARGLE',
  'SUPPOSITORY',
] as const;
/** Every form a stored drug may carry (older rows include SACHET), each with a `settings.drugs.form.*` name. */
const NAMED_FORMS = [...DRUG_FORMS, 'SACHET'] as const;
export const isDrugForm = (value: string): value is (typeof NAMED_FORMS)[number] =>
  (NAMED_FORMS as readonly string[]).includes(value);
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

/** Bangla digits typed into a number field become ASCII digits, so "১২৫০" parses. */
export const asciiDigits = (input: string): string =>
  input.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
