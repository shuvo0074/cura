import type { DocumentCategory } from '@cura/shared';
import type { CursorQuery, Page } from './repositories';

/**
 * Ports for the clinical record, catalogs, billing and settings.
 *
 * Kept in a second file purely for navigability — the contract style is
 * identical to `repositories.ts`: narrow interfaces, no Prisma types, symbol
 * tokens so services bind to abstractions.
 */

// ---------------------------------------------------------------------------
// Clinical record
// ---------------------------------------------------------------------------

export interface VitalsData {
  weightKg: number | null;
  systolic: number | null;
  diastolic: number | null;
  pulseBpm: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
}

export interface ClinicalNoteData {
  complaints: string[];
  observations: string[];
  diagnoses: string[];
  advice: string[];
  notes: string | null;
}

export interface PrescriptionItemData {
  drugName: string;
  strength: string | null;
  form: string | null;
  durationDays: number | null;
  morning: number;
  noon: number;
  night: number;
  mealRelation: 'BEFORE' | 'AFTER' | 'ANY';
  instruction: string | null;
}

export interface PrescriptionData {
  items: PrescriptionItemData[];
  investigations: string[];
  followUpDate: Date | null;
}

export interface EncounterDetail {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  appointmentId: string | null;
  occurredAt: Date;
  signedAt: Date | null;
  vitals: (VitalsData & { id: string }) | null;
  clinicalNote: (ClinicalNoteData & { id: string }) | null;
  prescription: (PrescriptionData & { id: string; signedAt: Date | null }) | null;
  documents: Array<{
    id: string;
    category: DocumentCategory;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    capturedOn: Date | null;
    createdAt: Date;
  }>;
}

export const CLINICAL_REPOSITORY = Symbol('CLINICAL_REPOSITORY');

export interface ClinicalRepository {
  findEncounter(id: string): Promise<EncounterDetail | null>;
  /** One encounter per appointment; returns the existing one if present. */
  openEncounter(input: {
    patientId: string;
    doctorId: string;
    appointmentId: string | null;
    occurredAt: Date;
  }): Promise<EncounterDetail>;
  /**
   * Timeline read. `notBefore` is the privacy cut-off — the repository never
   * returns rows older than it unless the caller has already established
   * consent and passes `null`.
   */
  timeline(input: {
    patientId: string;
    notBefore: Date | null;
    query: CursorQuery;
  }): Promise<Page<EncounterDetail>>;
  hasRecordsBefore(patientId: string, before: Date): Promise<boolean>;
  upsertVitals(encounterId: string, data: VitalsData): Promise<void>;
  upsertClinicalNote(encounterId: string, data: ClinicalNoteData): Promise<void>;
  upsertPrescription(encounterId: string, data: PrescriptionData): Promise<void>;
  /** Freezes the record. A signed encounter rejects further mutation. */
  sign(encounterId: string, at: Date): Promise<void>;
  isSigned(encounterId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Catalogs (drugs, clinical-note entries, pricing, charting templates)
// ---------------------------------------------------------------------------

export interface DrugRecord {
  id: string;
  name: string;
  form: string | null;
  strength: string | null;
  unit: string | null;
  instruction: string | null;
}

export interface CatalogEntryRecord {
  id: string;
  kind: string;
  value: string;
}

export interface PricingItemRecord {
  id: string;
  name: string;
  priceMinor: number;
  notes: string | null;
  isDefault: boolean;
}

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface CatalogRepository {
  searchDrugs(practiceId: string, term: string, limit: number): Promise<DrugRecord[]>;
  createDrug(practiceId: string, data: Omit<DrugRecord, 'id'>): Promise<DrugRecord>;
  deleteDrug(practiceId: string, id: string): Promise<void>;

  listEntries(practiceId: string, kind: string, term?: string): Promise<CatalogEntryRecord[]>;
  createEntry(practiceId: string, kind: string, value: string): Promise<CatalogEntryRecord>;
  deleteEntry(practiceId: string, id: string): Promise<void>;

  listPricing(practiceId: string): Promise<PricingItemRecord[]>;
  upsertPricing(
    practiceId: string,
    data: Omit<PricingItemRecord, 'id'> & { id?: string },
  ): Promise<PricingItemRecord>;
  deletePricing(practiceId: string, id: string): Promise<void>;

  listChartingTemplates(practiceId: string): Promise<
    Array<{ id: string; name: string; diagnoses: string[]; labOrders: string[]; followUpDays: number | null }>
  >;
  upsertChartingTemplate(
    practiceId: string,
    data: { id?: string; name: string; diagnoses: string[]; labOrders: string[]; followUpDays: number | null },
  ): Promise<{ id: string }>;
  deleteChartingTemplate(practiceId: string, id: string): Promise<void>;

  listDrugs(practiceId: string, term: string | undefined, limit: number): Promise<DrugRecord[]>;
  updateDrug(practiceId: string, id: string, data: Omit<DrugRecord, 'id'>): Promise<DrugRecord>;

  updateEntry(practiceId: string, id: string, value: string): Promise<CatalogEntryRecord>;
}

// ---------------------------------------------------------------------------
// Practice settings
// ---------------------------------------------------------------------------

export interface PracticeRecord {
  id: string;
  name: string;
  specialization: string | null;
  contactNumber: string | null;
  email: string | null;
  website: string | null;
  binNumber: string | null;
  address: string | null;
  addressLine1: string | null;
  locality: string | null;
  city: string | null;
  country: string;
  postCode: string | null;
  mapsUrl: string | null;
  logoUrl: string | null;
  roomNumber: string | null;
  slotMinutes: number;
  timezone: string;
  showTodayFirst: boolean;
  smsLanguage: string;
  hideCancelledInvoices: boolean;
  hideCancelledPayments: boolean;
}

/** Per-member notification matrix (spec: Practice Staff → Notifications). */
export interface StaffNotificationPrefs {
  notifyScheduleSms: boolean;
  notifyScheduleEmail: boolean;
  notifyAppointmentSms: boolean;
  notifyAppointmentEmail: boolean;
}

export interface StaffRecord extends StaffNotificationPrefs {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  role: string;
  bmdcNumber: string | null;
  isActive: boolean;
}

export const PRACTICE_REPOSITORY = Symbol('PRACTICE_REPOSITORY');

export interface PracticeRepository {
  findById(id: string): Promise<PracticeRecord | null>;
  update(id: string, patch: Partial<Omit<PracticeRecord, 'id'>>): Promise<PracticeRecord>;
  listSessions(practiceId: string): Promise<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>;
  replaceSessions(
    practiceId: string,
    sessions: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ): Promise<void>;
  listClosures(practiceId: string, from: Date, to: Date): Promise<Array<{ id: string; startsAt: Date; endsAt: Date; reason: string | null }>>;
  addClosure(practiceId: string, input: { startsAt: Date; endsAt: Date; allDay: boolean; reason: string | null }): Promise<{ id: string }>;
  removeClosure(practiceId: string, id: string): Promise<void>;

  listStaff(practiceId: string): Promise<StaffRecord[]>;
  addStaff(input: {
    practiceId: string;
    fullName: string;
    email: string | null;
    mobile: string | null;
    role: string;
    bmdcNumber: string | null;
    passwordHash: string;
  }): Promise<StaffRecord>;
  setStaffActive(practiceId: string, userId: string, isActive: boolean): Promise<void>;
  updateStaff(
    practiceId: string,
    userId: string,
    patch: {
      fullName?: string;
      email?: string | null;
      mobile?: string | null;
      bmdcNumber?: string | null;
      role?: string;
      notifications?: Partial<StaffNotificationPrefs>;
    },
  ): Promise<StaffRecord>;
}

export const SETTINGS_REPOSITORY = Symbol('SETTINGS_REPOSITORY');

export interface CommunicationSettingRecord {
  category: string;
  type: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
  offsetDays: number | null;
}

export interface PrintoutSettingRecord {
  documentType: string;
  printerType: string;
  paperSize: string;
  orientation: string;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  fontScale: number;
  showHeader: boolean;
  showFooter: boolean;
  headerHtml: string | null;
  footerHtml: string | null;
  padImageKey: string | null;
  sectionOrder: string[];
}

export interface EmailSettingRecord {
  /** HEADER | FOOTER */
  section: string;
  title: string | null;
  leftText: string | null;
  rightText: string | null;
  includeLogo: boolean;
}

export interface SettingsRepository {
  listCommunication(practiceId: string): Promise<CommunicationSettingRecord[]>;
  upsertCommunication(practiceId: string, record: CommunicationSettingRecord): Promise<void>;

  getPrintout(practiceId: string, documentType: string): Promise<PrintoutSettingRecord | null>;
  upsertPrintout(practiceId: string, record: PrintoutSettingRecord): Promise<void>;

  listConsentForms(practiceId: string): Promise<Array<{ id: string; title: string; bodyHtml: string; isActive: boolean }>>;
  upsertConsentForm(
    practiceId: string,
    data: { id?: string; title: string; bodyHtml: string; isActive: boolean },
  ): Promise<{ id: string }>;
  deleteConsentForm(practiceId: string, id: string): Promise<void>;

  listEmailSettings(practiceId: string): Promise<EmailSettingRecord[]>;
  upsertEmailSetting(practiceId: string, record: EmailSettingRecord): Promise<void>;

  getSubscription(practiceId: string): Promise<{ plan: string; status: string; expiresAt: Date | null } | null>;
  upsertSubscription(practiceId: string, plan: string, expiresAt: Date | null): Promise<void>;
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export interface InvoiceItemData {
  pricingItemId: string | null;
  description: string;
  quantity: number;
  unitMinor: number;
  discountMinor: number;
  totalMinor: number;
}

export interface InvoiceRecord {
  id: string;
  practiceId: string;
  patientId: string;
  encounterId: string | null;
  number: string;
  status: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  notes: string | null;
  issuedAt: Date | null;
  createdAt: Date;
  items: InvoiceItemData[];
}

export const BILLING_REPOSITORY = Symbol('BILLING_REPOSITORY');

/** An invoice row for the ledger, with the patient and payments joined. */
export interface InvoiceSummary {
  id: string;
  number: string;
  status: string;
  totalMinor: number;
  paidMinor: number;
  createdAt: Date;
  issuedAt: Date | null;
  patient: { id: string; fullName: string; curaId: string; mobile: string } | null;
}

export interface InvoiceFilter {
  status?: string | undefined;
  patientId?: string | undefined;
  /** Matches the invoice number or the patient's name. */
  q?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  /** Set from the practice's data-security preference. */
  includeCancelled: boolean;
  cursor?: string | undefined;
  limit: number;
}

export interface PaymentRecord {
  id: string;
  amountMinor: number;
  method: string;
  reference: string | null;
  receivedAt: Date;
}

export interface BillingRepository {
  findById(practiceId: string, id: string): Promise<InvoiceRecord | null>;
  listForPatient(practiceId: string, patientId: string, query: CursorQuery): Promise<Page<InvoiceRecord>>;
  listForPractice(
    practiceId: string,
    filter: InvoiceFilter,
  ): Promise<{ items: InvoiceSummary[]; nextCursor: string | null; outstandingMinor: number }>;
  listPayments(invoiceId: string): Promise<PaymentRecord[]>;
  /** Voids an invoice. Returns false when it is already cancelled or paid. */
  cancel(practiceId: string, id: string): Promise<boolean>;
  create(input: {
    practiceId: string;
    patientId: string;
    encounterId: string | null;
    number: string;
    items: InvoiceItemData[];
    discountMinor: number;
    taxMinor: number;
    notes: string | null;
    createdById: string;
  }): Promise<InvoiceRecord>;
  addPayment(input: {
    invoiceId: string;
    amountMinor: number;
    method: string;
    reference: string | null;
    receivedById: string;
  }): Promise<InvoiceRecord>;
  nextInvoiceNumber(practiceId: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const REPORT_REPOSITORY = Symbol('REPORT_REPOSITORY');

export interface IncomeRow {
  day: string;
  invoicedMinor: number;
  collectedMinor: number;
  invoiceCount: number;
}

export interface ReportRepository {
  income(practiceId: string, from: Date, to: Date): Promise<IncomeRow[]>;
  appointmentVolume(
    practiceId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ day: string; total: number; done: number; cancelled: number }>>;
  topProcedures(practiceId: string, from: Date, to: Date, limit: number): Promise<Array<{ name: string; count: number; revenueMinor: number }>>;
  patientDemographics(practiceId: string): Promise<Array<{ bucket: string; count: number }>>;
}
