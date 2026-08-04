import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app.config';

/**
 * HTTP bootstrap and the security posture of the process.
 *
 * Everything here is defence applied uniformly, before any route runs.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Buffer startup logs so a configuration failure is reported cleanly
    // rather than interleaved with framework noise.
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

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
  if (config.trustProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.setGlobalPrefix(config.apiPrefix);
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Cura API listening on :${config.port}/${config.apiPrefix} [${config.nodeEnv}]`);
}

bootstrap().catch((error) => {
  // Configuration and connection failures surface here. Exit non-zero so an
  // orchestrator restarts or halts the rollout rather than serving a broken app.

  console.error('Failed to start Cura API:', error);
  process.exit(1);
});
