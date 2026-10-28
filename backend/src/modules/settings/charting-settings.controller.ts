import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { practiceQuery } from './settings.schemas';
import { ChartingSettingsService } from './charting-settings.service';

const chartingSchema = practiceQuery.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  diagnoses: z.array(z.string().trim().max(160)).default([]),
  labOrders: z.array(z.string().trim().max(160)).default([]),
  followUpDays: z.number().int().min(1).max(365).nullable().default(null),
});

@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class ChartingSettingsController {
  constructor(private readonly settings: ChartingSettingsService) {}

  @Get('charting-templates')
  listCharting(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.listChartingTemplates(q.practiceId, p);
  }

  @Put('charting-templates')
  upsertCharting(@Body(zodBody(chartingSchema)) b: z.infer<typeof chartingSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...data } = b;
    return this.settings.upsertChartingTemplate(practiceId, data, p);
  }

  @Delete('charting-templates/:id')
  deleteCharting(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.deleteChartingTemplate(q.practiceId, id, p);
  }
}
