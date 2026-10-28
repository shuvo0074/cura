import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { practiceQuery } from './settings.schemas';
import { SubscriptionSettingsService } from './subscription-settings.service';

const subscriptionSchema = practiceQuery.extend({
  plan: z.enum(['FREE', 'PREMIUM']),
  months: z.number().int().min(1).max(36).default(12),
});

@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class SubscriptionSettingsController {
  constructor(private readonly settings: SubscriptionSettingsService) {}

  @Get('subscription')
  getSubscription(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.getSubscription(q.practiceId, p);
  }

  @Put('subscription')
  setSubscription(@Body(zodBody(subscriptionSchema)) b: z.infer<typeof subscriptionSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.setSubscription(b.practiceId, b.plan, b.months, p);
  }
}
