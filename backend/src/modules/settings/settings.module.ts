import { Module } from '@nestjs/common';
import { SettingsAuditTrail } from './settings-audit';
import { PracticeSettingsController } from './practice-settings.controller';
import { PracticeSettingsService } from './practice-settings.service';
import { StaffSettingsController } from './staff-settings.controller';
import { StaffSettingsService } from './staff-settings.service';
import { CatalogSettingsController } from './catalog-settings.controller';
import { CatalogSettingsService } from './catalog-settings.service';
import { PricingSettingsController } from './pricing-settings.controller';
import { PricingSettingsService } from './pricing-settings.service';
import { ChartingSettingsController } from './charting-settings.controller';
import { ChartingSettingsService } from './charting-settings.service';
import { CommunicationSettingsController } from './communication-settings.controller';
import { CommunicationSettingsService } from './communication-settings.service';
import { PrintoutSettingsController } from './printout-settings.controller';
import { PrintoutSettingsService } from './printout-settings.service';
import { ConsentFormSettingsController } from './consent-form-settings.controller';
import { ConsentFormSettingsService } from './consent-form-settings.service';
import { SubscriptionSettingsController } from './subscription-settings.controller';
import { SubscriptionSettingsService } from './subscription-settings.service';

/**
 * Practice settings, one controller/service pair per settings screen. All of
 * them share the `/settings` prefix, so the HTTP surface is unchanged by the
 * split.
 */
@Module({
  controllers: [
    PracticeSettingsController,
    StaffSettingsController,
    CatalogSettingsController,
    PricingSettingsController,
    ChartingSettingsController,
    CommunicationSettingsController,
    PrintoutSettingsController,
    ConsentFormSettingsController,
    SubscriptionSettingsController,
  ],
  providers: [
    SettingsAuditTrail,
    PracticeSettingsService,
    StaffSettingsService,
    CatalogSettingsService,
    PricingSettingsService,
    ChartingSettingsService,
    CommunicationSettingsService,
    PrintoutSettingsService,
    ConsentFormSettingsService,
    SubscriptionSettingsService,
  ],
})
export class SettingsModule {}
