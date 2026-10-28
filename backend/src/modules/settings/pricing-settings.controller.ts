import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { practiceQuery } from './settings.schemas';
import { PricingSettingsService } from './pricing-settings.service';

const pricingSchema = practiceQuery.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  priceMinor: z.number().int().min(0),
  notes: z.string().trim().max(400).nullable().default(null),
});

/** Price list. Reading opts down to `CATALOG_READ` like the other catalog
 *  lookups; editing stays administrator-only. */
@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class PricingSettingsController {
  constructor(private readonly settings: PricingSettingsService) {}

  @Get('pricing')
  @RequirePermissions(Permission.CATALOG_READ)
  listPricing(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.listPricing(q.practiceId, p);
  }

  @Put('pricing')
  upsertPricing(@Body(zodBody(pricingSchema)) b: z.infer<typeof pricingSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...data } = b;
    return this.settings.upsertPricing(practiceId, data, p);
  }

  @Delete('pricing/:id')
  deletePricing(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.deletePricing(q.practiceId, id, p);
  }
}
