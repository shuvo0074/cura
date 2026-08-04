import type { AppConfig } from '../config/app-config';
import type { ApiErrorBody } from '../domain/models';
import {
  defaultMessages,
  err,
  kindFromStatus,
  makeError,
  ok,
  type AppError,
  type Result,
} from '../utils/result';
import { tokenStore } from './token-store';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Skips the Authorization header (login, refresh). */
  anonymous?: boolean;
  /** Opt out of automatic retry for non-idempotent operations. */
  retry?: boolean;
}

type Unsubscribe = () => void;

/**
 * HTTP transport.
 *
 * Responsibilities kept in one place so features never touch `fetch` directly:
 * auth header injection, single-flight token refresh, timeouts, bounded retry
 * with jitter, and normalising every failure into a typed `AppError`.
 */
export class HttpClient {
  /**
   * In-flight refresh promise.
   *
   * When several requests 401 at once they all await this single promise rather
   * than each firing their own refresh — otherwise concurrent rotations would
   * invalidate each other and log the user out.
   */
  private refreshInFlight: Promise<boolean> | null = null;
  private readonly sessionExpiredHandlers = new Set<() => void>();

  constructor(private readonly config: AppConfig) {}

  onSessionExpired(handler: () => void): Unsubscribe {
    this.sessionExpiredHandlers.add(handler);
    return () => this.sessionExpiredHandlers.delete(handler);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<Result<T, AppError>> {
    const { method = 'GET', retry = method === 'GET' } = options;
    const attempts = retry ? this.config.network.retry.attempts : 1;

    let lastError: AppError = makeError('unknown', defaultMessages.unknown);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const result = await this.send<T>(path, options, attempt === 0);

      if (result.ok) return result;
      lastError = result.error;

      // Only transient classes are worth retrying; a 422 will fail identically.
      if (!lastError.retryable || attempt === attempts - 1) break;

      await this.backoff(attempt);
    }

    return err(lastError);
  }

  // -------------------------------------------------------------------------

  private async send<T>(
    path: string,
    options: RequestOptions,
    allowRefresh: boolean,
  ): Promise<Result<T, AppError>> {
    const url = this.buildUrl(path, options.query);

    // Compose the caller's abort signal with our own timeout so a hung socket
    // cannot leave a pending promise forever.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.config.network.requestTimeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout.signal])
      : timeout.signal;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (!options.anonymous) {
      const token = tokenStore.get();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        // Required for the httpOnly refresh cookie to travel on /auth routes.
        credentials: 'include',
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal,
        // Prevents a cached 401 or stale record being replayed by the browser.
        cache: 'no-store',
        redirect: 'error',
      });

      if (response.status === 401 && allowRefresh && !options.anonymous) {
        const refreshed = await this.refreshOnce();
        if (refreshed) return this.send<T>(path, options, false);

        tokenStore.clear();
        this.sessionExpiredHandlers.forEach((h) => h());
        return err(makeError('unauthorized', defaultMessages.unauthorized));
      }

      if (response.status === 204) return ok(undefined as T);

      if (!response.ok) return err(await this.toAppError(response));

      return ok((await response.json()) as T);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        // Caller-initiated cancellation is not a failure to report.
        if (options.signal?.aborted) {
          return err(makeError('unknown', 'Request cancelled'));
        }
        return err(makeError('timeout', defaultMessages.timeout));
      }
      return err(makeError('network', defaultMessages.network));
    } finally {
      clearTimeout(timer);
    }
  }

  private async refreshOnce(): Promise<boolean> {
    this.refreshInFlight ??= (async () => {
      try {
        const response = await fetch(this.buildUrl('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) return false;

        const body = (await response.json()) as { accessToken: string; expiresIn: number };
        tokenStore.set(body.accessToken, body.expiresIn);
        return true;
      } catch {
        return false;
      } finally {
        // Cleared on the next tick so late-arriving 401s join this result
        // instead of starting a second rotation.
        queueMicrotask(() => {
          this.refreshInFlight = null;
        });
      }
    })();

    return this.refreshInFlight;
  }

  /**
   * Converts an error response into a typed `AppError`.
   *
   * Server text is used only for validation failures, where it names a field.
   * Every other class falls back to our own copy, so backend internals are
   * never rendered into the UI.
   */
  private async toAppError(response: Response): Promise<AppError> {
    const kind = kindFromStatus(response.status);
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await response.json()) as Partial<ApiErrorBody>;
    } catch {
      /* non-JSON error page */
    }

    const useServerMessage = kind === 'validation' || kind === 'conflict' || kind === 'rate_limited';

    return makeError(kind, useServerMessage && body.message ? body.message : defaultMessages[kind], {
      ...(body.code ? { code: body.code } : {}),
      ...(body.details ? { fieldErrors: body.details } : {}),
      ...(body.requestId ? { requestId: body.requestId } : {}),
    });
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(
      `${this.config.env.apiBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`,
    );
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  /** Exponential backoff with full jitter, to avoid synchronised retry storms. */
  private backoff(attempt: number): Promise<void> {
    const { baseDelayMs, maxDelayMs } = this.config.network.retry;
    const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    const delay = Math.random() * ceiling;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
