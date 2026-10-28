import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { practiceQuery } from './settings.schemas';
import { PrintoutSettingsService } from './printout-settings.service';

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

@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class PrintoutSettingsController {
  constructor(private readonly settings: PrintoutSettingsService) {}

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
}
