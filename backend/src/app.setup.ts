import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppConfigService } from './config/app.config';

/**
 * HTTP pipeline shared by the real server and the integration tests, so tests
 * exercise the same headers, body limits and prefix that production runs.
 */
export function configureApp(app: NestExpressApplication): AppConfigService {
  const config = app.get(AppConfigService);

  /**
   * Security headers.
   *
   * The API returns JSON only, so the CSP is maximally restrictive: no script,
   * no frame ancestors, nothing to load. If an endpoint is ever coerced into
   * returning HTML, the browser will still refuse to execute anything in it.
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      // Prevents MIME sniffing turning a JSON body into an executable type.
      noSniff: true,
      frameguard: { action: 'deny' },
    }),
  );

  // Removes the framework fingerprint from responses.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  /**
   * CORS with an explicit allowlist. `credentials: true` is required for the
   * refresh cookie, which makes a wildcard origin both invalid and unsafe —
   * `loadEnv` refuses to boot production without explicit origins.
   */
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.use(compression());

  /**
   * Body size ceiling. Uploads go through a dedicated multipart route with its
   * own limit; JSON endpoints have no legitimate reason to exceed 256 KB, and
   * capping it removes a cheap memory-exhaustion vector.
   */
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { limit: '256kb', extended: true });

  // Correct client IPs behind a load balancer — required for per-IP throttling
  // to work at all. Only enabled where a trusted proxy actually terminates TLS.
  if (config.trustProxy > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxy);
  }

  app.setGlobalPrefix(config.apiPrefix);
  app.enableShutdownHooks();

  return config;
}
