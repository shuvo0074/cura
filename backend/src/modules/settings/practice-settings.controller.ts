import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission, practiceSessionSchema } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { optionalText, practiceQuery } from './settings.schemas';
import { PracticeSettingsService } from './practice-settings.service';

const practicePatchSchema = practiceQuery.extend({
  name: z.string().trim().min(2).max(160).optional(),
  specialization: optionalText(120),
  contactNumber: optionalText(20),
  email: z.union([z.string().email(), z.literal('')]).nullable().optional().transform((v) => (v === '' ? null : v)),
  website: z.union([z.string().url().max(200), z.literal('')]).nullable().optional().transform((v) => (v === '' ? null : v)),
  binNumber: optionalText(40),
  address: optionalText(400),
  addressLine1: optionalText(200),
  locality: optionalText(120),
  city: optionalText(80),
  country: z.string().trim().min(2).max(80).optional(),
  postCode: optionalText(12),
  mapsUrl: z.union([z.string().url().max(512), z.literal('')]).nullable().optional().transform((v) => (v === '' ? null : v)),
  logoUrl: optionalText(512),
  roomNumber: optionalText(40),
  slotMinutes: z.number().int().min(5).max(60).optional(),
});

/** Spec 6.6.c.1.4 — calendar display defaults and appointment duration. */
const calendarSchema = practiceQuery.extend({
  showTodayFirst: z.boolean().optional(),
  slotMinutes: z.number().int().min(5).max(60).optional(),
});

/** Spec: Data Security — 2FA plus the cancelled-document visibility flags. */
const securitySchema = practiceQuery.extend({
  hideCancelledInvoices: z.boolean().optional(),
  hideCancelledPayments: z.boolean().optional(),
});

const sessionsSchema = practiceQuery.extend({
  sessions: z.array(practiceSessionSchema).max(21),
});

const closureSchema = practiceQuery.extend({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  allDay: z.boolean().default(true),
  reason: z.string().trim().max(240).nullable().default(null),
});

/** Practice profile, sessions and closures, plus the screens that only flip
 *  practice columns (calendar defaults, data security). Administrator-only. */
@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class PracticeSettingsController {
  constructor(private readonly settings: PracticeSettingsService) {}

  @Get('practice')
  getPractice(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.getPractice(q.practiceId, p);
  }

  @Put('practice')
  updatePractice(@Body(zodBody(practicePatchSchema)) b: z.infer<typeof practicePatchSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...patch } = b;
    return this.settings.updatePractice(practiceId, patch, p);
  }

  @Put('practice/sessions')
  replaceSessions(@Body(zodBody(sessionsSchema)) b: z.infer<typeof sessionsSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.replaceSessions(b.practiceId, b.sessions, p);
  }

  @Get('practice/closures')
  listClosures(
    @Query(zodBody(practiceQuery.extend({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) })))
    q: { practiceId: string; from: string; to: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.listClosures(q.practiceId, new Date(q.from), new Date(q.to), p);
  }

  @Post('practice/closures')
  addClosure(@Body(zodBody(closureSchema)) b: z.infer<typeof closureSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.addClosure(
      b.practiceId,
      { startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt), allDay: b.allDay, reason: b.reason },
      p,
    );
  }

  @Delete('practice/closures/:id')
  removeClosure(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.removeClosure(q.practiceId, id, p);
  }

  // -- Calendar defaults (spec 6.6.c.1.4) ------------------------------------

  @Put('calendar')
  updateCalendar(@Body(zodBody(calendarSchema)) b: z.infer<typeof calendarSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...patch } = b;
    return this.settings.updatePractice(practiceId, patch, p);
  }

  // -- Data security ---------------------------------------------------------

  @Put('security')
  updateSecurity(@Body(zodBody(securitySchema)) b: z.infer<typeof securitySchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...patch } = b;
    return this.settings.updatePractice(practiceId, patch, p);
  }
}
