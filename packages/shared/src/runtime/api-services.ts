import type { AppointmentStatus } from '../domain/enums';
import type {
  Appointment,
  AuthSession,
  LoginResult,
  OtpChallenge,
  PatientSearchHit,
  QueueSummary,
} from '../domain/models';
import type { CreateAppointmentInput, LoginInput, RegisterInput } from '../validation/schemas';
import type { AppError, Result } from '../utils/result';
import type { HttpClient } from './http-client';
import { tokenStore } from './token-store';

/**
 * Typed API services.
 *
 * ViewModels depend on these interfaces rather than on `HttpClient`, so a test
 * can supply a fake without a network stack, and an endpoint change is
 * contained to one adapter.
 */

export interface AuthApi {
  login(input: LoginInput): Promise<Result<LoginResult, AppError>>;
  /** Creates a doctor account. Always answers with an OTP challenge, never a session. */
  register(input: RegisterInput): Promise<Result<{ status: 'otp_required'; challenge: OtpChallenge }, AppError>>;
  verifyOtp(challengeId: string, code: string): Promise<Result<AuthSession, AppError>>;
  restoreSession(): Promise<Result<{ accessToken: string; expiresIn: number }, AppError>>;
  logout(): Promise<void>;
}

export class HttpAuthApi implements AuthApi {
  constructor(private readonly http: HttpClient) {}

  async login(input: LoginInput): Promise<Result<LoginResult, AppError>> {
    const result = await this.http.request<LoginResult>('/auth/login', {
      method: 'POST',
      body: input,
      anonymous: true,
      retry: false,
    });
    if (result.ok && result.value.status === 'authenticated') {
      tokenStore.set(result.value.session.accessToken, result.value.session.expiresIn);
    }
    return result;
  }

  async register(
    input: RegisterInput,
  ): Promise<Result<{ status: 'otp_required'; challenge: OtpChallenge }, AppError>> {
    return this.http.request<{ status: 'otp_required'; challenge: OtpChallenge }>('/auth/register', {
      method: 'POST',
      body: input,
      anonymous: true,
      retry: false,
    });
  }

  async verifyOtp(challengeId: string, code: string): Promise<Result<AuthSession, AppError>> {
    const result = await this.http.request<AuthSession>('/auth/verify-otp', {
      method: 'POST',
      body: { challengeId, code },
      anonymous: true,
      retry: false,
    });
    if (result.ok) tokenStore.set(result.value.accessToken, result.value.expiresIn);
    return result;
  }

  /** Re-establishes a session on cold load using the httpOnly refresh cookie. */
  async restoreSession(): Promise<Result<{ accessToken: string; expiresIn: number }, AppError>> {
    const result = await this.http.request<{ accessToken: string; expiresIn: number }>(
      '/auth/refresh',
      { method: 'POST', anonymous: true, retry: false },
    );
    if (result.ok) tokenStore.set(result.value.accessToken, result.value.expiresIn);
    return result;
  }

  async logout(): Promise<void> {
    await this.http.request<void>('/auth/logout', { method: 'POST', retry: false });
    tokenStore.clear();
  }
}

/** A doctor whose diary can be viewed and booked into. */
export interface BookableDoctor {
  id: string;
  fullName: string;
}

export interface AppointmentApi {
  listRange(input: {
    practiceId: string;
    from: string;
    to: string;
    doctorId?: string;
    signal?: AbortSignal;
  }): Promise<Result<Appointment[], AppError>>;
  /** Today's counters; one doctor's when `doctorId` is given. */
  queueSummary(practiceId: string, date: string, doctorId?: string): Promise<Result<QueueSummary, AppError>>;
  /** The practice's doctors, lead consultant first. */
  listDoctors(practiceId: string): Promise<Result<BookableDoctor[], AppError>>;
  /** Bookings per local day across a window — the mini month's load dots. */
  dailyCounts(input: {
    practiceId: string;
    from: string;
    to: string;
    timeZone: string;
    doctorId?: string;
    signal?: AbortSignal;
  }): Promise<Result<Array<{ date: string; count: number }>, AppError>>;
  create(input: CreateAppointmentInput): Promise<Result<Appointment, AppError>>;
  changeStatus(id: string, status: AppointmentStatus): Promise<Result<Appointment, AppError>>;
  reschedule(id: string, scheduledAt: string): Promise<Result<Appointment, AppError>>;
}

export class HttpAppointmentApi implements AppointmentApi {
  constructor(private readonly http: HttpClient) {}

  listRange(input: {
    practiceId: string;
    from: string;
    to: string;
    doctorId?: string;
    signal?: AbortSignal;
  }) {
    return this.http.request<Appointment[]>('/appointments', {
      query: {
        practiceId: input.practiceId,
        from: input.from,
        to: input.to,
        doctorId: input.doctorId,
      },
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }

  queueSummary(practiceId: string, date: string, doctorId?: string) {
    return this.http.request<QueueSummary>('/appointments/queue-summary', {
      query: { practiceId, date, doctorId },
    });
  }

  listDoctors(practiceId: string) {
    return this.http.request<BookableDoctor[]>('/appointments/doctors', { query: { practiceId } });
  }

  dailyCounts(input: {
    practiceId: string;
    from: string;
    to: string;
    timeZone: string;
    doctorId?: string;
    signal?: AbortSignal;
  }) {
    return this.http.request<Array<{ date: string; count: number }>>('/appointments/daily-counts', {
      query: {
        practiceId: input.practiceId,
        from: input.from,
        to: input.to,
        timeZone: input.timeZone,
        doctorId: input.doctorId,
      },
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }

  create(input: CreateAppointmentInput) {
    return this.http.request<Appointment>('/appointments', {
      method: 'POST',
      body: input,
      retry: false,
    });
  }

  changeStatus(id: string, status: AppointmentStatus) {
    return this.http.request<Appointment>(`/appointments/${id}/status`, {
      method: 'PATCH',
      body: { status },
      retry: false,
    });
  }

  reschedule(id: string, scheduledAt: string) {
    return this.http.request<Appointment>(`/appointments/${id}/reschedule`, {
      method: 'PATCH',
      body: { scheduledAt },
      retry: false,
    });
  }
}

export interface PatientApi {
  search(
    practiceId: string,
    term: string,
    signal?: AbortSignal,
  ): Promise<Result<PatientSearchHit[], AppError>>;
}

export class HttpPatientApi implements PatientApi {
  constructor(private readonly http: HttpClient) {}

  search(practiceId: string, term: string, signal?: AbortSignal) {
    return this.http.request<PatientSearchHit[]>('/patients/search', {
      query: { practiceId, q: term },
      ...(signal ? { signal } : {}),
    });
  }
}
