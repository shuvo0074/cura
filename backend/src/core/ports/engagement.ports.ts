/**
 * Ports for patient engagement: outreach lists and visit feedback.
 *
 * Same contract style as `repositories.ts` — narrow interfaces, no Prisma
 * types, symbol tokens so services bind to abstractions.
 */

export const ENGAGEMENT_REPOSITORY = Symbol('ENGAGEMENT_REPOSITORY');

export interface OutreachPatient {
  id: string;
  curaId: string;
  fullName: string;
  mobile: string;
  email: string | null;
}

export interface FollowUpDue {
  patient: OutreachPatient;
  /** ISO date (YYYY-MM-DD). */
  dueDate: string;
  /** PRESCRIPTION: a follow-up date the doctor wrote. RECALL: the preventive
   *  recall computed from the last visit. */
  source: 'PRESCRIPTION' | 'RECALL';
}

export interface BirthdayDue {
  patient: OutreachPatient;
  /** Next occurrence, ISO date. */
  date: string;
  /** Age the patient turns on that date. */
  turning: number;
}

export interface FeedbackRecord {
  id: string;
  patient: OutreachPatient;
  appointmentId: string | null;
  rating: number;
  comment: string | null;
  reply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
}

export interface FeedbackSummary {
  count: number;
  average: number | null;
  /** Index 0 holds 1-star counts, index 4 five-star. */
  distribution: [number, number, number, number, number];
}

export interface EngagementRepository {
  prescribedFollowUps(practiceId: string, from: Date, to: Date): Promise<FollowUpDue[]>;
  /** Patients whose last visit plus `offsetDays` falls inside the window. */
  recallsDue(practiceId: string, offsetDays: number, from: Date, to: Date): Promise<FollowUpDue[]>;
  birthdaysDue(practiceId: string, from: Date, days: number): Promise<BirthdayDue[]>;

  listFeedback(practiceId: string, filter: { rating?: number; unanswered?: boolean }): Promise<FeedbackRecord[]>;
  feedbackSummary(practiceId: string): Promise<FeedbackSummary>;
  createFeedback(data: {
    practiceId: string;
    patientId: string;
    appointmentId: string | null;
    rating: number;
    comment: string | null;
    createdById: string;
  }): Promise<FeedbackRecord>;
  /** Returns null when the entry does not exist in that practice. */
  replyToFeedback(practiceId: string, id: string, reply: string, userId: string): Promise<FeedbackRecord | null>;
  patientInPractice(practiceId: string, patientId: string): Promise<boolean>;
  recallOffsetDays(practiceId: string): Promise<number | null>;
}
