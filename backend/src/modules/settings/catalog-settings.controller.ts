import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { practiceQuery } from './settings.schemas';
import { CatalogSettingsService } from './catalog-settings.service';

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

/**
 * Drug and clinical-note catalogs.
 *
 * `SETTINGS_MANAGE` at the class level, so a new endpoint is administrator-only
 * unless it says otherwise. The *lookups* opt down to `CATALOG_READ` because
 * they back the auto-suggest on the prescription screen — a doctor has to
 * reach them, and a method-level decorator overrides the class one.
 */
@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class CatalogSettingsController {
  constructor(private readonly settings: CatalogSettingsService) {}

  // -- Drugs -----------------------------------------------------------------

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

  // -- Clinical-note entries -------------------------------------------------

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
}
