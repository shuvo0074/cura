import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  Permission,
  UserRole,
  bdMobileSchema,
  passwordSchema,
  practiceSessionSchema,
} from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { SettingsService } from './settings.service';

const practiceQuery = z.object({ practiceId: z.string().uuid() });

/** Empty strings from a cleared form field mean "unset", not "save a blank". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

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

const staffPatchSchema = practiceQuery.extend({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.union([z.string().email(), z.literal('')]).nullable().optional().transform((v) => (v === '' ? null : v)),
  mobile: bdMobileSchema.nullable().optional(),
  bmdcNumber: optionalText(20),
  role: z.nativeEnum(UserRole).optional(),
  notifyScheduleSms: z.boolean().optional(),
  notifyScheduleEmail: z.boolean().optional(),
  notifyAppointmentSms: z.boolean().optional(),
  notifyAppointmentEmail: z.boolean().optional(),
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

const staffSchema = practiceQuery.extend({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email().nullable().default(null),
  mobile: bdMobileSchema.nullable().default(null),
  role: z.nativeEnum(UserRole),
  bmdcNumber: z.string().trim().max(20).nullable().default(null),
  temporaryPassword: passwordSchema,
});

const drugSchema = practiceQuery.extend({
  name: z.string().trim().min(1).max(160),
  form: z.string().trim().max(40).nullable().default(null),
  strength: z.string().trim().max(40).nullable().default(null),
  unit: z.string().trim().max(20).nullable().default(null),
  instruction: z.string().trim().max(300).nullable().default(null),
});

const CATALOG_KINDS = ['COMPLAINT', 'OBSERVATION', 'DIAGNOSIS', 'ADVICE', 'NOTE'] as const;

const catalogEntrySchema = practiceQuery.extend({
  kind: z.enum(CATALOG_KINDS),
  value: z.string().trim().min(1).max(300),
});

const pricingSchema = practiceQuery.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  priceMinor: z.number().int().min(0),
  notes: z.string().trim().max(400).nullable().default(null),
});

const chartingSchema = practiceQuery.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  diagnoses: z.array(z.string().trim().max(160)).default([]),
  labOrders: z.array(z.string().trim().max(160)).default([]),
  followUpDays: z.number().int().min(1).max(365).nullable().default(null),
});

const communicationSchema = practiceQuery.extend({
  category: z.enum(['APPOINTMENT', 'FOLLOW_UP', 'PAYMENT', 'WISHES']),
  type: z.enum(['CONFIRMATION', 'CANCELLATION', 'REMINDER', 'INVOICE', 'BIRTHDAY', 'ANNIVERSARY']),
  smsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  offsetDays: z.number().int().min(0).max(3650).nullable().default(null),
});

const printoutSchema = practiceQuery.extend({
  documentType: z.enum(['EMR', 'BILLING']),
  printerType: z.enum(['COLOUR', 'MONOCHROME', 'DOT_MATRIX']).default('COLOUR'),
  paperSize: z.enum(['A4', 'A5', 'LETTER']).default('A4'),
  orientation: z.enum(['PORTRAIT', 'LANDSCAPE']).default('PORTRAIT'),
  marginTopMm: z.number().int().min(0).max(120).default(50),
  marginBottomMm: z.number().int().min(0).max(120).default(12),
  marginLeftMm: z.number().int().min(0).max(120).default(6),
  marginRightMm: z.number().int().min(0).max(120).default(6),
  fontScale: z.number().int().min(50).max(200).default(100),
  showHeader: z.boolean().default(true),
  showFooter: z.boolean().default(true),
  headerHtml: z.string().max(2000).nullable().default(null),
  footerHtml: z.string().max(2000).nullable().default(null),
  padImageKey: z.string().max(512).nullable().default(null),
  sectionOrder: z.array(z.string().max(40)).max(20).default([]),
});

const consentFormSchema = practiceQuery.extend({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  bodyHtml: z.string().max(20_000),
  isActive: z.boolean().default(true),
});

const subscriptionSchema = practiceQuery.extend({
  plan: z.enum(['FREE', 'PREMIUM']),
  months: z.number().int().min(1).max(36).default(12),
});

/**
 * Settings surface.
 *
 * `SETTINGS_MANAGE` at the class level, so a new endpoint is administrator-only
 * unless it says otherwise. The catalogue *lookups* opt down to `CATALOG_READ`
 * because they back the auto-suggest on the prescription screen — a doctor has
 * to reach them, and a method-level decorator overrides the class one.
 */
@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // -- Practice --------------------------------------------------------------

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

  // -- Staff -----------------------------------------------------------------

  @Get('staff')
  @RequirePermissions(Permission.STAFF_MANAGE)
  listStaff(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.listStaff(q.practiceId, p);
  }

  @Post('staff')
  @RequirePermissions(Permission.STAFF_MANAGE)
  addStaff(@Body(zodBody(staffSchema)) b: z.infer<typeof staffSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...rest } = b;
    return this.settings.addStaff(practiceId, rest, p);
  }

  /** The kill-switch: revokes access immediately, not at token expiry. */
  @Put('staff/:userId/access')
  @RequirePermissions(Permission.STAFF_MANAGE)
  setStaffAccess(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(zodBody(practiceQuery.extend({ isActive: z.boolean() }))) b: { practiceId: string; isActive: boolean },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.setStaffActive(b.practiceId, userId, b.isActive, p);
  }

  @Patch('staff/:userId')
  @RequirePermissions(Permission.STAFF_MANAGE)
  updateStaff(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(zodBody(staffPatchSchema)) b: z.infer<typeof staffPatchSchema>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    const {
      practiceId,
      notifyScheduleSms,
      notifyScheduleEmail,
      notifyAppointmentSms,
      notifyAppointmentEmail,
      ...details
    } = b;

    // Only forward the notification keys the caller actually sent, so a patch
    // that touches the name alone does not reset the whole matrix to defaults.
    const notifications = {
      ...(notifyScheduleSms !== undefined ? { notifyScheduleSms } : {}),
      ...(notifyScheduleEmail !== undefined ? { notifyScheduleEmail } : {}),
      ...(notifyAppointmentSms !== undefined ? { notifyAppointmentSms } : {}),
      ...(notifyAppointmentEmail !== undefined ? { notifyAppointmentEmail } : {}),
    };

    return this.settings.updateStaff(
      practiceId,
      userId,
      { ...details, ...(Object.keys(notifications).length > 0 ? { notifications } : {}) },
      p,
    );
  }

  // -- Catalogs --------------------------------------------------------------

  @Get('drugs')
  @RequirePermissions(Permission.CATALOG_READ)
  searchDrugs(
    @Query(zodBody(practiceQuery.extend({ q: z.string().trim().min(1) }))) q: { practiceId: string; q: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.searchDrugs(q.practiceId, q.q, p);
  }

  /** Table view for the catalog screen; `q` narrows it, absence lists everything. */
  @Get('drugs/list')
  @RequirePermissions(Permission.CATALOG_READ)
  listDrugs(
    @Query(zodBody(practiceQuery.extend({ q: z.string().trim().optional() }))) q: { practiceId: string; q?: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.listDrugs(q.practiceId, q.q, p);
  }

  @Post('drugs')
  createDrug(@Body(zodBody(drugSchema)) b: z.infer<typeof drugSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...data } = b;
    return this.settings.createDrug(practiceId, data, p);
  }

  @Put('drugs/:id')
  updateDrug(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(drugSchema)) b: z.infer<typeof drugSchema>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    const { practiceId, ...data } = b;
    return this.settings.updateDrug(practiceId, id, data, p);
  }

  @Delete('drugs/:id')
  deleteDrug(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.deleteDrug(q.practiceId, id, p);
  }

  @Get('catalog')
  @RequirePermissions(Permission.CATALOG_READ)
  listCatalog(
    @Query(zodBody(practiceQuery.extend({ kind: z.enum(CATALOG_KINDS), q: z.string().trim().optional() })))
    q: { practiceId: string; kind: string; q?: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.listCatalog(q.practiceId, q.kind, q.q, p);
  }

  @Post('catalog')
  createCatalogEntry(@Body(zodBody(catalogEntrySchema)) b: z.infer<typeof catalogEntrySchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.createCatalogEntry(b.practiceId, b.kind, b.value, p);
  }

  @Put('catalog/:id')
  updateCatalogEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(practiceQuery.extend({ value: z.string().trim().min(1).max(300) })))
    b: { practiceId: string; value: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.updateCatalogEntry(b.practiceId, id, b.value, p);
  }

  @Delete('catalog/:id')
  deleteCatalogEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.deleteCatalogEntry(q.practiceId, id, p);
  }

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

  // -- Communications / printouts / consent / subscription -------------------

  @Get('communications')
  listCommunication(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.listCommunication(q.practiceId, p);
  }

  @Put('communications')
  upsertCommunication(@Body(zodBody(communicationSchema)) b: z.infer<typeof communicationSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...record } = b;
    return this.settings.upsertCommunication(practiceId, record, p);
  }

  /** Outgoing SMS language (spec: Communications → Language Settings). */
  @Put('communications/language')
  setSmsLanguage(
    @Body(zodBody(practiceQuery.extend({ smsLanguage: z.enum(['en', 'bn']) })))
    b: { practiceId: string; smsLanguage: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.updatePractice(b.practiceId, { smsLanguage: b.smsLanguage }, p);
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

  @Get('printouts')
  getPrintout(
    @Query(zodBody(practiceQuery.extend({ documentType: z.enum(['EMR', 'BILLING']).default('EMR') })))
    q: { practiceId: string; documentType: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.getPrintout(q.practiceId, q.documentType, p);
  }

  @Put('printouts')
  upsertPrintout(@Body(zodBody(printoutSchema)) b: z.infer<typeof printoutSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...record } = b;
    return this.settings.upsertPrintout(practiceId, record, p);
  }

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

  @Get('subscription')
  getSubscription(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.getSubscription(q.practiceId, p);
  }

  @Put('subscription')
  setSubscription(@Body(zodBody(subscriptionSchema)) b: z.infer<typeof subscriptionSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.setSubscription(b.practiceId, b.plan, b.months, p);
  }
}
