/**
 * Outbound service ports.
 *
 * Every side effect that leaves the process — messaging, storage, time, cache —
 * is expressed as an interface here. Application services depend on the port;
 * `infrastructure/` supplies the adapter. This keeps SMS/email providers
 * swappable (spec allows several) and makes time deterministic in tests.
 */

export const CLOCK = Symbol('CLOCK');

/** Injecting time removes hidden `new Date()` calls and makes tests exact. */
export interface Clock {
  now(): Date;
  addSeconds(date: Date, seconds: number): Date;
  addDays(date: Date, days: number): Date;
  startOfDay(date: Date, timeZone: string): Date;
  endOfDay(date: Date, timeZone: string): Date;
}

export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsMessage {
  to: string;
  body: string;
  /** Correlates gateway delivery reports back to a domain event. */
  reference?: string;
}

export interface SmsSender {
  send(message: SmsMessage): Promise<{ providerMessageId: string | null }>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ providerMessageId: string | null }>;
}

export const CACHE = Symbol('CACHE');

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /**
   * Atomic counter used for rate limiting and OTP resend cooldowns.
   * Returns the value after increment.
   */
  increment(key: string, ttlSeconds: number): Promise<number>;
  /** Best-effort distributed lock; returns false when already held. */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
  checksum: string;
}

export interface FileStorage {
  put(input: {
    key: string;
    body: Buffer;
    mimeType: string;
  }): Promise<StoredFile>;
  /** Short-lived signed URL — assets are never publicly readable. */
  signedUrl(storageKey: string, ttlSeconds: number): Promise<string>;
  delete(storageKey: string): Promise<void>;
}

export const EVENT_BUS = Symbol('EVENT_BUS');

/**
 * Domain events. Publishing is fire-and-forget from the caller's perspective so
 * a slow SMS gateway never blocks an HTTP response (spec: "Ensure the SMS
 * trigger is asynchronous so the UI doesn't freeze").
 */
export type DomainEvent =
  | { type: 'patient.registered'; patientId: string; practiceId: string; curaId: string; mobile: string; fullName: string }
  | { type: 'appointment.created'; appointmentId: string; practiceId: string; doctorId: string; patientId: string }
  | { type: 'appointment.rescheduled'; appointmentId: string; practiceId: string; previousAt: string; newAt: string }
  | { type: 'appointment.status_changed'; appointmentId: string; practiceId: string; status: string }
  | { type: 'queue.changed'; practiceId: string; date: string };

export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(handler: (event: DomainEvent) => void | Promise<void>): () => void;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');

export interface IdGenerator {
  uuid(): string;
}
