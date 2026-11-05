// Must stay the first import: see runtime-tuning.ts.
import './runtime-tuning';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

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

  const logger = new Logger('Bootstrap');
  const config = configureApp(app);

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Cura API listening on :${config.port}/${config.apiPrefix} [${config.nodeEnv}]`);
}

bootstrap().catch((error) => {
  // Configuration and connection failures surface here. Exit non-zero so an
  // orchestrator restarts or halts the rollout rather than serving a broken app.

  console.error('Failed to start Cura API:', error);
  process.exit(1);
});
