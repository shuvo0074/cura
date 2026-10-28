/**
 * Port for the account-creation wizard.
 *
 * Same contract style as `repositories.ts` — narrow interfaces, no Prisma
 * types, symbol tokens so services bind to abstractions. The wizard's rules
 * (gate, skippable steps, one-time execution) stay in the service; this only
 * stores what it decides.
 */

export const ONBOARDING_REPOSITORY = Symbol('ONBOARDING_REPOSITORY');

export interface OnboardingProgress {
  step: number;
  complete: boolean;
  /** The autosaved draft, or null when nothing has been saved yet. */
  draft: Record<string, unknown> | null;
}

export interface PersonalDetailsRecord {
  fullName: string;
  mobile: string;
  email: string;
  gender: string;
  dateOfBirth: Date | null;
  bloodGroup: string | null;
  secondaryPhone: string | null;
  locale: string;
  /** Only written when an NID was supplied; an absent NID leaves the stored one. */
  nid?: { encrypted: Buffer; fingerprint: string } | undefined;
}

export interface QualificationRecord {
  degreeName: string;
  instituteName: string;
  passingYear: number | null;
  country: string | null;
}

export interface AwardRecord {
  title: string;
  year: number | null;
  issuer: string | null;
  country: string | null;
}

export interface OnboardingRepository {
  findProgress(userId: string): Promise<OnboardingProgress | null>;
  isComplete(userId: string): Promise<boolean>;
  findDraft(userId: string): Promise<Record<string, unknown> | null>;
  saveDraft(userId: string, step: number, draft: Record<string, unknown>): Promise<void>;
  /** Stores the draft and moves the step pointer in one transaction. */
  saveDraftAndAdvance(userId: string, step: number, draft: Record<string, unknown>, nextStep: number): Promise<void>;
  setStep(userId: string, step: number): Promise<void>;
  markComplete(userId: string, finalStep: number): Promise<void>;

  /** Uniqueness checks exclude the caller, so re-submitting a step is not a clash. */
  nidTakenByOther(fingerprint: string, userId: string): Promise<boolean>;
  bmdcTakenByOther(bmdcNumber: string, userId: string): Promise<boolean>;

  savePersonalDetails(userId: string, details: PersonalDetailsRecord): Promise<void>;
  setBmdcNumber(userId: string, bmdcNumber: string): Promise<void>;
  /** Replaces both lists wholesale, atomically. */
  replaceAcademicRecord(userId: string, qualifications: QualificationRecord[], awards: AwardRecord[]): Promise<void>;
}
