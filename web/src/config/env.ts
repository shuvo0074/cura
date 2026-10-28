import { createAppConfig, type AppConfig, type ClientEnv } from '@cura/shared';

/**
 * Client environment.
 *
 * Only `VITE_`-prefixed values are exposed by Vite, which prevents a server
 * secret from being inlined into the bundle by accident. Everything read here
 * is public by definition.
 */
function readEnv(): ClientEnv {
  const raw = import.meta.env;
  const environment = (raw.VITE_ENVIRONMENT ?? 'development') as ClientEnv['environment'];

  const env: ClientEnv = {
    apiBaseUrl: raw.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
    wsBaseUrl: raw.VITE_WS_BASE_URL ?? 'ws://localhost:3000',
    environment,
  };

  if (raw.VITE_SENTRY_DSN) env.sentryDsn = raw.VITE_SENTRY_DSN;

  // A path ("/api") means the API is proxied on the page's own origin, which is
  // https whenever the page is; anything absolute must be https outright.
  if (environment === 'production' && !/^(https:\/\/|\/)/.test(env.apiBaseUrl)) {
    // Fail loudly rather than shipping a build that sends credentials in clear.
    throw new Error('VITE_API_BASE_URL must be https or a same-origin path in production builds');
  }

  return env;
}

export const appConfig: AppConfig = createAppConfig(readEnv());
