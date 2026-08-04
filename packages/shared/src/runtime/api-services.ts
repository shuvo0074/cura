import type { AppointmentStatus } from '../domain/enums';
import type {
  Appointment,
  AuthSession,
  LoginResult,
  PatientSearchHit,
  QueueSummary,
} from '../domain/models';
import type { CreateAppointmentInput, LoginInput } from '../validation/schemas';
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

export interface AppointmentApi {
  listRange(input: {
    practiceId: string;
    from: string;
    to: string;
    doctorId?: string;
    signal?: AbortSignal;
  }): Promise<Result<Appointment[], AppError>>;
  queueSummary(practiceId: string, date: string): Promise<Result<QueueSummary, AppError>>;
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

  queueSummary(practiceId: string, date: string) {
    return this.http.request<QueueSummary>('/appointments/queue-summary', {
      query: { practiceId, date },
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
