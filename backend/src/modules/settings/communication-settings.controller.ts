import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { practiceQuery } from './settings.schemas';
import { CommunicationSettingsService } from './communication-settings.service';
import { PracticeSettingsService } from './practice-settings.service';

const communicationSchema = practiceQuery.extend({
  category: z.enum(['APPOINTMENT', 'FOLLOW_UP', 'PAYMENT', 'WISHES']),
  type: z.enum(['CONFIRMATION', 'CANCELLATION', 'REMINDER', 'INVOICE', 'BIRTHDAY', 'ANNIVERSARY']),
  smsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  offsetDays: z.number().int().min(0).max(3650).nullable().default(null),
});

/** Like `optionalText`, but always resolves to a value — the email editor sends
 *  every block on each save, so an absent field means "cleared", not "untouched". */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => (v === '' ? null : v));

const emailSettingSchema = practiceQuery.extend({
  section: z.enum(['HEADER', 'FOOTER']),
  title: clearableText(160),
  leftText: clearableText(1000),
  rightText: clearableText(1000),
  includeLogo: z.boolean().default(true),
});

@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class CommunicationSettingsController {
  constructor(
    private readonly settings: CommunicationSettingsService,
    private readonly practice: PracticeSettingsService,
  ) {}

  @Get('communications')
  listCommunication(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.listCommunication(q.practiceId, p);
  }

  @Put('communications')
  upsertCommunication(@Body(zodBody(communicationSchema)) b: z.infer<typeof communicationSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...record } = b;
    return this.settings.upsertCommunication(practiceId, record, p);
  }

  /**
   * Outgoing SMS language (spec: Communications → Language Settings). Lives on
   * this screen but is a practice column, so it is saved as a practice update.
   */
  @Put('communications/language')
  setSmsLanguage(
    @Body(zodBody(practiceQuery.extend({ smsLanguage: z.enum(['en', 'bn']) })))
    b: { practiceId: string; smsLanguage: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.practice.updatePractice(b.practiceId, { smsLanguage: b.smsLanguage }, p);
  }

  @Get('email')
  getEmailSettings(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.getEmailSettings(q.practiceId, p);
  }

  @Put('email')
  upsertEmailSetting(@Body(zodBody(emailSettingSchema)) b: z.infer<typeof emailSettingSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...record } = b;
    return this.settings.upsertEmailSetting(practiceId, record, p);
  }
}
