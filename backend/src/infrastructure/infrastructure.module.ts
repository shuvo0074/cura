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
  CHARTING_TEMPLATE_REPOSITORY,
  CLINICAL_NOTE_CATALOG_REPOSITORY,
  CLINICAL_REPOSITORY,
  COMMUNICATION_SETTINGS_REPOSITORY,
  CONSENT_FORM_REPOSITORY,
  DRUG_CATALOG_REPOSITORY,
  EMAIL_SETTINGS_REPOSITORY,
  PRACTICE_REPOSITORY,
  PRESCRIBER_REPOSITORY,
  PRICING_REPOSITORY,
  PRINTOUT_SETTINGS_REPOSITORY,
  REPORT_REPOSITORY,
  STAFF_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '../core/ports/clinical.ports';
import { ONBOARDING_REPOSITORY } from '../core/ports/onboarding.ports';
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
import { PrismaOnboardingRepository } from './repositories/onboarding.repository';
import { PrismaPrescriberRepository } from './repositories/prescriber.repository';
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
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
    { provide: REPORT_REPOSITORY, useClass: PrismaReportRepository },
    { provide: DOCUMENT_REPOSITORY, useClass: PrismaDocumentRepository },
    { provide: FILE_STORAGE, useClass: LocalFileStorage },
    { provide: ENGAGEMENT_REPOSITORY, useClass: PrismaEngagementRepository },
    { provide: ONBOARDING_REPOSITORY, useClass: PrismaOnboardingRepository },
    { provide: PRESCRIBER_REPOSITORY, useClass: PrismaPrescriberRepository },

    // Adapters that implement several narrow ports are registered once and
    // aliased, so each port is a view onto one instance rather than a copy.
    PrismaCatalogRepository,
    { provide: DRUG_CATALOG_REPOSITORY, useExisting: PrismaCatalogRepository },
    { provide: CLINICAL_NOTE_CATALOG_REPOSITORY, useExisting: PrismaCatalogRepository },
    { provide: PRICING_REPOSITORY, useExisting: PrismaCatalogRepository },
    { provide: CHARTING_TEMPLATE_REPOSITORY, useExisting: PrismaCatalogRepository },
    PrismaPracticeRepository,
    { provide: PRACTICE_REPOSITORY, useExisting: PrismaPracticeRepository },
    { provide: STAFF_REPOSITORY, useExisting: PrismaPracticeRepository },
    PrismaSettingsRepository,
    { provide: COMMUNICATION_SETTINGS_REPOSITORY, useExisting: PrismaSettingsRepository },
    { provide: EMAIL_SETTINGS_REPOSITORY, useExisting: PrismaSettingsRepository },
    { provide: PRINTOUT_SETTINGS_REPOSITORY, useExisting: PrismaSettingsRepository },
    { provide: CONSENT_FORM_REPOSITORY, useExisting: PrismaSettingsRepository },
    { provide: SUBSCRIPTION_REPOSITORY, useExisting: PrismaSettingsRepository },
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
    BILLING_REPOSITORY,
    REPORT_REPOSITORY,
    PRACTICE_REPOSITORY,
    DOCUMENT_REPOSITORY,
    FILE_STORAGE,
    ENGAGEMENT_REPOSITORY,
    ONBOARDING_REPOSITORY,
    PRESCRIBER_REPOSITORY,
    DRUG_CATALOG_REPOSITORY,
    CLINICAL_NOTE_CATALOG_REPOSITORY,
    PRICING_REPOSITORY,
    CHARTING_TEMPLATE_REPOSITORY,
    STAFF_REPOSITORY,
    COMMUNICATION_SETTINGS_REPOSITORY,
    EMAIL_SETTINGS_REPOSITORY,
    PRINTOUT_SETTINGS_REPOSITORY,
    CONSENT_FORM_REPOSITORY,
    SUBSCRIPTION_REPOSITORY,
  ],
})
export class InfrastructureModule {}
