import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission, UserRole, passwordSchema, practiceSessionSchema } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { SettingsService } from './settings.service';

const practiceQuery = z.object({ practiceId: z.string().uuid() });

const practicePatchSchema = practiceQuery.extend({
  name: z.string().trim().min(2).max(160).optional(),
  specialization: z.string().trim().max(120).nullable().optional(),
  contactNumber: z.string().trim().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().trim().max(400).nullable().optional(),
  mapsUrl: z.string().url().nullable().optional(),
  roomNumber: z.string().trim().max(40).nullable().optional(),
  slotMinutes: z.number().int().min(5).max(60).optional(),
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
  mobile: z.string().trim().max(20).nullable().default(null),
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
 * Read endpoints require `SETTINGS_MANAGE` alongside writes: the catalogs and
 * staff list disclose the practice's internal structure, so they are not
 * broadly readable.
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

  // -- Catalogs --------------------------------------------------------------

  @Get('drugs')
  searchDrugs(
    @Query(zodBody(practiceQuery.extend({ q: z.string().trim().min(1) }))) q: { practiceId: string; q: string },
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.searchDrugs(q.practiceId, q.q, p);
  }

  @Post('drugs')
  createDrug(@Body(zodBody(drugSchema)) b: z.infer<typeof drugSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    const { practiceId, ...data } = b;
    return this.settings.createDrug(practiceId, data, p);
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

  @Delete('catalog/:id')
  deleteCatalogEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>,
    @CurrentUser() p: AuthenticatedPrincipal,
  ) {
    return this.settings.deleteCatalogEntry(q.practiceId, id, p);
  }

  @Get('pricing')
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

  @Get('subscription')
  getSubscription(@Query(zodBody(practiceQuery)) q: z.infer<typeof practiceQuery>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.getSubscription(q.practiceId, p);
  }

  @Put('subscription')
  setSubscription(@Body(zodBody(subscriptionSchema)) b: z.infer<typeof subscriptionSchema>, @CurrentUser() p: AuthenticatedPrincipal) {
    return this.settings.setSubscription(b.practiceId, b.plan, b.months, p);
  }
}
