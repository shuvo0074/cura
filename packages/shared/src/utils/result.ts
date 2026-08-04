/**
 * Explicit success/failure type.
 *
 * ViewModels return `Result` rather than throwing, so views handle both
 * branches at the type level and an unhandled rejection cannot reach the UI.
 */

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

export interface AppError {
  kind: ErrorKind;
  /** Safe to show to a user. Never contains server internals or PHI. */
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
  retryable: boolean;
}

const RETRYABLE: ReadonlySet<ErrorKind> = new Set(['network', 'timeout', 'rate_limited', 'server']);

export function makeError(
  kind: ErrorKind,
  message: string,
  extra: Partial<Omit<AppError, 'kind' | 'message' | 'retryable'>> = {},
): AppError {
  return { kind, message, retryable: RETRYABLE.has(kind), ...extra };
}

/** Maps an HTTP status onto an error kind. */
export function kindFromStatus(status: number): ErrorKind {
  switch (status) {
    case 400:
    case 422:
      return 'validation';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 429:
      return 'rate_limited';
    default:
      return status >= 500 ? 'server' : 'unknown';
  }
}

/** User-facing copy. Deliberately generic — server messages may leak detail. */
export const defaultMessages: Record<ErrorKind, string> = {
  network: 'Cannot reach the server. Check your connection and try again.',
  timeout: 'The request took too long. Please try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to do that.',
  not_found: 'We could not find what you were looking for.',
  conflict: 'That change conflicts with the current data. Refresh and retry.',
  validation: 'Please check the highlighted fields.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};
