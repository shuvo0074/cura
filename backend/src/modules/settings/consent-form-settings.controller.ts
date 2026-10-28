import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { practiceQuery } from './settings.schemas';
import { ConsentFormSettingsService } from './consent-form-settings.service';

const consentFormSchema = practiceQuery.extend({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  bodyHtml: z.string().max(20_000),
  isActive: z.boolean().default(true),
});

@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class ConsentFormSettingsController {
  constructor(private readonly settings: ConsentFormSettingsService) {}

  @Get('consent-forms')
  listConsentForms(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.listConsentForms(q.practiceId, p);
  }

  @Put('consent-forms')
  upsertConsentForm(@Body(zodBody(consentFormSchema)) b: z.infer<typeof consentFormSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...data } = b;
    return this.settings.upsertConsentForm(practiceId, data, p);
  }

  @Delete('consent-forms/:id')
  deleteConsentForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.deleteConsentForm(q.practiceId, id, p);
  }
}
