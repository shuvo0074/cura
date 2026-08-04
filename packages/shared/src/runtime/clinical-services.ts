import type { AppError, Result } from '../utils/result';
import type { HttpClient } from './http-client';

/**
 * API adapters for the clinical record, onboarding, settings and billing.
 *
 * Same contract style as `api-services.ts`: ViewModels depend on the interface,
 * the HTTP class is one substitutable implementation.
 */

// ---------------------------------------------------------------------------
// Clinical
// ---------------------------------------------------------------------------

export interface EncounterVitals {
  id: string;
  weightKg: number | null;
  systolic: number | null;
  diastolic: number | null;
  pulseBpm: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
}

export interface EncounterNote {
  id: string;
  complaints: string[];
  observations: string[];
  diagnoses: string[];
  advice: string[];
  notes: string | null;
}

export interface EncounterPrescriptionItem {
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

export interface EncounterPrescription {
  id: string;
  signedAt: string | null;
  items: EncounterPrescriptionItem[];
  investigations: string[];
  followUpDate: string | null;
}

export interface EncounterView {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  appointmentId: string | null;
  occurredAt: string;
  signedAt: string | null;
  vitals: EncounterVitals | null;
  clinicalNote: EncounterNote | null;
  prescription: EncounterPrescription | null;
  documents: Array<{ id: string; category: string; fileName: string; createdAt: string }>;
}

export interface TimelineView {
  entries: EncounterView[];
  nextCursor: string | null;
  privacyWindowDays: number;
  hasLockedHistory: boolean;
  consentGrantedUntil: string | null;
}

export interface ClinicalApi {
  timeline(
    practiceId: string,
    patientId: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<Result<TimelineView, AppError>>;
  openEncounter(practiceId: string, appointmentId: string): Promise<Result<EncounterView, AppError>>;
  saveVitals(practiceId: string, encounterId: string, body: unknown): Promise<Result<EncounterView, AppError>>;
  saveNote(practiceId: string, encounterId: string, body: unknown): Promise<Result<EncounterView, AppError>>;
  savePrescription(practiceId: string, encounterId: string, body: unknown): Promise<Result<EncounterView, AppError>>;
  sign(practiceId: string, encounterId: string): Promise<Result<EncounterView, AppError>>;
  requestConsent(practiceId: string, patientId: string): Promise<Result<{ challengeId: string; maskedDestination: string }, AppError>>;
  confirmConsent(practiceId: string, challengeId: string, code: string): Promise<Result<{ expiresAt: string }, AppError>>;
}

export class HttpClinicalApi implements ClinicalApi {
  constructor(private readonly http: HttpClient) {}

  timeline(practiceId: string, patientId: string, cursor?: string, signal?: AbortSignal) {
    return this.http.request<TimelineView>(`/clinical/patients/${patientId}/timeline`, {
      query: { practiceId, cursor },
      ...(signal ? { signal } : {}),
    });
  }

  openEncounter(practiceId: string, appointmentId: string) {
    return this.http.request<EncounterView>(`/clinical/appointments/${appointmentId}/encounter`, {
      method: 'POST',
      body: { practiceId },
      retry: false,
    });
  }

  saveVitals(practiceId: string, encounterId: string, body: unknown) {
    return this.http.request<EncounterView>(`/clinical/encounters/${encounterId}/vitals`, {
      method: 'PUT',
      query: { practiceId },
      body,
      retry: false,
    });
  }

  saveNote(practiceId: string, encounterId: string, body: unknown) {
    return this.http.request<EncounterView>(`/clinical/encounters/${encounterId}/note`, {
      method: 'PUT',
      query: { practiceId },
      body,
      retry: false,
    });
  }

  savePrescription(practiceId: string, encounterId: string, body: unknown) {
    return this.http.request<EncounterView>(`/clinical/encounters/${encounterId}/prescription`, {
      method: 'PUT',
      query: { practiceId },
      body,
      retry: false,
    });
  }

  sign(practiceId: string, encounterId: string) {
    return this.http.request<EncounterView>(`/clinical/encounters/${encounterId}/sign`, {
      method: 'POST',
      body: { practiceId },
      retry: false,
    });
  }

  requestConsent(practiceId: string, patientId: string) {
    return this.http.request<{ challengeId: string; maskedDestination: string }>(
      `/clinical/patients/${patientId}/consent/request`,
      { method: 'POST', body: { practiceId }, retry: false },
    );
  }

  confirmConsent(practiceId: string, challengeId: string, code: string) {
    return this.http.request<{ expiresAt: string }>('/clinical/consent/confirm', {
      method: 'POST',
      body: { practiceId, challengeId, code },
      retry: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export interface OnboardingStateView {
  step: number;
  completed: boolean;
  completedSteps: number[];
  draft: Record<string, unknown>;
}

export interface OnboardingApi {
  getState(): Promise<Result<OnboardingStateView, AppError>>;
  saveDraft(step: number, payload: Record<string, unknown>): Promise<Result<{ savedAt: string }, AppError>>;
  submitStep(step: number, payload: unknown): Promise<Result<OnboardingStateView, AppError>>;
  skipStep(step: number): Promise<Result<OnboardingStateView, AppError>>;
  finish(): Promise<Result<OnboardingStateView, AppError>>;
}

export class HttpOnboardingApi implements OnboardingApi {
  constructor(private readonly http: HttpClient) {}

  getState() {
    return this.http.request<OnboardingStateView>('/onboarding/state');
  }

  saveDraft(step: number, payload: Record<string, unknown>) {
    return this.http.request<{ savedAt: string }>('/onboarding/draft', {
      method: 'POST',
      body: { step, payload },
      retry: false,
    });
  }

  submitStep(step: number, payload: unknown) {
    return this.http.request<OnboardingStateView>(`/onboarding/steps/${step}`, {
      method: 'POST',
      body: payload,
      retry: false,
    });
  }

  skipStep(step: number) {
    return this.http.request<OnboardingStateView>(`/onboarding/steps/${step}/skip`, {
      method: 'POST',
      retry: false,
    });
  }

  finish() {
    return this.http.request<OnboardingStateView>('/onboarding/finish', {
      method: 'POST',
      retry: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Settings & catalogs
// ---------------------------------------------------------------------------

export interface DrugSuggestion {
  id: string;
  name: string;
  form: string | null;
  strength: string | null;
  instruction: string | null;
}

export interface PricingItemView {
  id: string;
  name: string;
  priceMinor: number;
  notes: string | null;
}

export interface SettingsApi {
  searchDrugs(practiceId: string, term: string, signal?: AbortSignal): Promise<Result<DrugSuggestion[], AppError>>;
  listCatalog(practiceId: string, kind: string, term?: string, signal?: AbortSignal): Promise<Result<Array<{ id: string; value: string }>, AppError>>;
  listPricing(practiceId: string): Promise<Result<PricingItemView[], AppError>>;
  upsertPricing(practiceId: string, data: { id?: string; name: string; priceMinor: number; notes: string | null }): Promise<Result<PricingItemView, AppError>>;
  listStaff(practiceId: string): Promise<Result<Array<{ userId: string; fullName: string; role: string; isActive: boolean }>, AppError>>;
  setStaffAccess(practiceId: string, userId: string, isActive: boolean): Promise<Result<unknown, AppError>>;
}

export class HttpSettingsApi implements SettingsApi {
  constructor(private readonly http: HttpClient) {}

  searchDrugs(practiceId: string, term: string, signal?: AbortSignal) {
    return this.http.request<DrugSuggestion[]>('/settings/drugs', {
      query: { practiceId, q: term },
      ...(signal ? { signal } : {}),
    });
  }

  listCatalog(practiceId: string, kind: string, term?: string, signal?: AbortSignal) {
    return this.http.request<Array<{ id: string; value: string }>>('/settings/catalog', {
      query: { practiceId, kind, q: term },
      ...(signal ? { signal } : {}),
    });
  }

  listPricing(practiceId: string) {
    return this.http.request<PricingItemView[]>('/settings/pricing', { query: { practiceId } });
  }

  upsertPricing(practiceId: string, data: { id?: string; name: string; priceMinor: number; notes: string | null }) {
    return this.http.request<PricingItemView>('/settings/pricing', {
      method: 'PUT',
      body: { practiceId, ...data },
      retry: false,
    });
  }

  listStaff(practiceId: string) {
    return this.http.request<Array<{ userId: string; fullName: string; role: string; isActive: boolean }>>(
      '/settings/staff',
      { query: { practiceId } },
    );
  }

  setStaffAccess(practiceId: string, userId: string, isActive: boolean) {
    return this.http.request<unknown>(`/settings/staff/${userId}/access`, {
      method: 'PUT',
      body: { practiceId, isActive },
      retry: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Billing & reports
// ---------------------------------------------------------------------------

export interface InvoiceView {
  id: string;
  number: string;
  status: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  items: Array<{ description: string; quantity: number; unitMinor: number; totalMinor: number }>;
}

export interface ReportResult {
  rows: Array<Record<string, string | number>>;
  totals?: { invoicedMinor: number; collectedMinor: number; invoiceCount: number };
}

export interface BillingApi {
  createInvoice(practiceId: string, body: unknown): Promise<Result<InvoiceView, AppError>>;
  addPayment(practiceId: string, invoiceId: string, body: unknown): Promise<Result<InvoiceView, AppError>>;
  listForPatient(practiceId: string, patientId: string): Promise<Result<{ items: InvoiceView[] }, AppError>>;
  report(practiceId: string, kind: string, from: string, to: string): Promise<Result<ReportResult, AppError>>;
}

export class HttpBillingApi implements BillingApi {
  constructor(private readonly http: HttpClient) {}

  createInvoice(practiceId: string, body: unknown) {
    return this.http.request<InvoiceView>('/billing/invoices', {
      method: 'POST',
      body: { practiceId, ...(body as object) },
      retry: false,
    });
  }

  addPayment(practiceId: string, invoiceId: string, body: unknown) {
    return this.http.request<InvoiceView>(`/billing/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: { practiceId, ...(body as object) },
      retry: false,
    });
  }

  listForPatient(practiceId: string, patientId: string) {
    return this.http.request<{ items: InvoiceView[] }>(`/billing/patients/${patientId}/invoices`, {
      query: { practiceId },
    });
  }

  report(practiceId: string, kind: string, from: string, to: string) {
    return this.http.request<ReportResult>('/billing/reports', {
      query: { practiceId, kind, from, to },
    });
  }
}
