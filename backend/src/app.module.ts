import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './infrastructure/adapters/redis-throttler.storage';
import { DirectoryModule } from './modules/directory/directory.module';
import { DirectoryAccessGuard } from './modules/directory/access/directory-access.guard';
import { AppConfigService } from './config/app.config';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { GlobalExceptionFilter } from './common/http/exception.filter';
import { RequestContextMiddleware } from './common/http/request-context.middleware';
import { JwtAuthGuard } from './common/security/jwt-auth.guard';
import { PermissionsGuard } from './common/security/permissions.guard';
import { AuthModule } from './modules/auth/auth.module';
import { AppointmentModule } from './modules/appointments/appointment.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { SettingsModule } from './modules/settings/settings.module';
import { BillingModule } from './modules/billing/billing.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { DocumentModule } from './modules/documents/document.module';
import { PatientModule } from './modules/patients/patient.module';
import { AccountModule } from './modules/account/account.module';
import { EngagementModule } from './modules/engagement/engagement.module';

/**
 * Application root.
 *
 * Guards are registered globally and in order — throttle, then authenticate,
 * then authorise. Registering them here rather than per-controller means a new
 * endpoint is protected by default; opting out is an explicit, reviewable
 * `@Public()`.
 */
@Module({
  imports: [
    InfrastructureModule,
    // JwtAuthGuard is registered globally below, so JwtService must resolve in
    // this module's context — not only inside AuthModule. Secrets are passed
    // per-call from AppConfigService rather than baked in here, which keeps the
    // access and refresh keys distinct.
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService, RedisThrottlerStorage],
      useFactory: (config: AppConfigService, storage: RedisThrottlerStorage) => ({
        // Shared counters, so limits hold across restarts and API instances.
        storage,
        throttlers: [
          {
            ttl: config.throttle.ttlSeconds * 1000,
            limit: config.throttle.limit,
          },
        ],
        // Also skips the per-route @Throttle limits (login, register, OTP),
        // which is what lets the e2e suite sign in repeatedly.
        skipIf: () => config.throttle.disabled,
      }),
    }),
    AuthModule,
    AppointmentModule,
    ClinicalModule,
    OnboardingModule,
    SettingsModule,
    BillingModule,
    RealtimeModule,
    DocumentModule,
    PatientModule,
    AccountModule,
    EngagementModule,
    DirectoryModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: DirectoryAccessGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
