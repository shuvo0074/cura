/** Wire shapes for `/engagement/feedback`. */

export interface FeedbackPatient {
  id: string;
  curaId: string;
  fullName: string;
  mobile: string;
}

export interface FeedbackItem {
  id: string;
  patient: FeedbackPatient;
  appointmentId: string | null;
  rating: number;
  comment: string | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface FeedbackResponse {
  summary: {
    count: number;
    average: number | null;
    /** Index 0 = 1 star … index 4 = 5 stars. */
    distribution: [number, number, number, number, number];
  };
  items: FeedbackItem[];
}

export type FeedbackFilter = 'all' | 'unanswered' | 1 | 2 | 3 | 4 | 5;

export const stars = (rating: number): string => '★'.repeat(rating) + '☆'.repeat(5 - rating);
