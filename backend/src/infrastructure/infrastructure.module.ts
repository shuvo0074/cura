import { Global, Module } from '@nestjs/common';
import { AppConfigService, ENV_TOKEN } from '../config/app.config';
import { loadEnv } from '../config/env.schema';
import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from './prisma/prisma.service';
import {
  APPOINTMENT_REPOSITORY,
  AUDIT_REPOSITORY,
  CONSENT_REPOSITORY,
  DOCUMENT_REPOSITORY,
  OTP_REPOSITORY,
  PATIENT_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from '../core/ports/repositories';
import {
  BILLING_REPOSITORY,
  CATALOG_REPOSITORY,
  CLINICAL_REPOSITORY,
  PRACTICE_REPOSITORY,
  REPORT_REPOSITORY,
  SETTINGS_REPOSITORY,
} from '../core/ports/clinical.ports';
import {
  CACHE,
  CLOCK,
  EMAIL_SENDER,
  EVENT_BUS,
  FILE_STORAGE,
  ID_GENERATOR,
  SMS_SENDER,
} from '../core/ports/services';
import { PrismaUserRepository } from './repositories/user.repository';
import { PrismaOtpRepository, PrismaRefreshTokenRepository } from './repositories/auth.repositories';
import { PrismaAuditRepository } from './repositories/audit.repository';
import { PrismaPatientRepository } from './repositories/patient.repository';
import { PrismaAppointmentRepository } from './repositories/appointment.repository';
import { PrismaClinicalRepository } from './repositories/clinical.repository';
import { PrismaConsentRepository } from './repositories/consent.repository';
import { PrismaCatalogRepository } from './repositories/catalog.repository';
import { PrismaBillingRepository, PrismaReportRepository } from './repositories/billing.repository';
import { PrismaPracticeRepository, PrismaSettingsRepository } from './repositories/practice.repository';
import { PrismaDocumentRepository } from './repositories/document.repository';
import { PrismaEngagementRepository } from './repositories/engagement.repository';
import { ENGAGEMENT_REPOSITORY } from '../core/ports/engagement.ports';
import { LocalFileStorage } from './adapters/file-storage.adapter';
import {
  ConsoleEmailSender,
  ConsoleSmsSender,
  InMemoryEventBus,
  RedisCache,
  SystemClock,
  UuidGenerator,
} from './adapters/system.adapters';

/**
 * Composition root.
 *
 * This is the single place where abstract ports are bound to concrete adapters.
 * Feature modules inject only the symbols, so swapping Postgres for something
 * else, or the console SMS driver for a real gateway, is a change here and
 * nowhere else.
 */
@Global()
@Module({
  providers: [
    { provide: ENV_TOKEN, useFactory: () => loadEnv() },
    AppConfigService,
    CryptoService,
    PrismaService,

    // Outbound service ports
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    { provide: CACHE, useClass: RedisCache },
    { provide: EVENT_BUS, useClass: InMemoryEventBus },
    { provide: SMS_SENDER, useClass: ConsoleSmsSender },
    { provide: EMAIL_SENDER, useClass: ConsoleEmailSender },

    // Repository ports
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: OTP_REPOSITORY, useClass: PrismaOtpRepository },
    { provide: AUDIT_REPOSITORY, useClass: PrismaAuditRepository },
    { provide: PATIENT_REPOSITORY, useClass: PrismaPatientRepository },
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },
    { provide: CLINICAL_REPOSITORY, useClass: PrismaClinicalRepository },
    { provide: CONSENT_REPOSITORY, useClass: PrismaConsentRepository },
    { provide: CATALOG_REPOSITORY, useClass: PrismaCatalogRepository },
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
    { provide: REPORT_REPOSITORY, useClass: PrismaReportRepository },
    { provide: PRACTICE_REPOSITORY, useClass: PrismaPracticeRepository },
    { provide: SETTINGS_REPOSITORY, useClass: PrismaSettingsRepository },
    { provide: DOCUMENT_REPOSITORY, useClass: PrismaDocumentRepository },
    { provide: FILE_STORAGE, useClass: LocalFileStorage },
    { provide: ENGAGEMENT_REPOSITORY, useClass: PrismaEngagementRepository },
  ],
  exports: [
    AppConfigService,
    CryptoService,
    PrismaService,
    CLOCK,
    ID_GENERATOR,
    CACHE,
    EVENT_BUS,
    SMS_SENDER,
    EMAIL_SENDER,
    USER_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    OTP_REPOSITORY,
    AUDIT_REPOSITORY,
    PATIENT_REPOSITORY,
    APPOINTMENT_REPOSITORY,
    CLINICAL_REPOSITORY,
    CONSENT_REPOSITORY,
    CATALOG_REPOSITORY,
    BILLING_REPOSITORY,
    REPORT_REPOSITORY,
    PRACTICE_REPOSITORY,
    SETTINGS_REPOSITORY,
    DOCUMENT_REPOSITORY,
    FILE_STORAGE,
    ENGAGEMENT_REPOSITORY,
  ],
})
export class InfrastructureModule {}
