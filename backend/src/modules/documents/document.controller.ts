import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { DocumentCategory, Permission, businessRules } from '@cura/shared';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import { zodBody } from '../../common/http/zod-validation.pipe';
import { ValidationError } from '../../common/errors/domain-error';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { DocumentService } from './document.service';
import { PrintoutService } from '../printouts/printout.service';

const uploadQuery = z.object({
  practiceId: z.string().uuid(),
  category: z.nativeEnum(DocumentCategory),
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
});

const practiceQuery = z.object({ practiceId: z.string().uuid() });

const browseQuery = practiceQuery.extend({
  category: z.nativeEnum(DocumentCategory).optional(),
  patientId: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(businessRules.pagination.maxPageSize)
    .default(businessRules.pagination.defaultPageSize),
});

/**
 * Document upload, retrieval and printing.
 *
 * Files are buffered in memory with a hard byte cap enforced by multer *before*
 * the handler runs, so an oversized upload is rejected at the transport layer
 * rather than after the process has already absorbed it.
 */
@Controller('documents')
export class DocumentController {
  constructor(
    private readonly documents: DocumentService,
    private readonly printouts: PrintoutService,
  ) {}

  @Post()
  @RequirePermissions(Permission.PATIENT_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: businessRules.uploads.maxFileBytes,
        files: 1,
        // Keeps a multipart body from carrying an unbounded number of fields.
        fields: 10,
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query(zodBody(uploadQuery)) query: z.infer<typeof uploadQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    if (!file) throw new ValidationError('No file was uploaded.');

    return this.documents.upload(
      {
        buffer: file.buffer,
        declaredMimeType: file.mimetype,
        originalName: file.originalname,
        category: query.category,
        practiceId: query.practiceId,
        patientId: query.patientId,
        encounterId: query.encounterId,
      },
      principal,
    );
  }

  /** Practice-wide browse backing the Documents module. */
  @Get()
  @RequirePermissions(Permission.PATIENT_READ)
  browse(
    @Query(zodBody(browseQuery)) query: z.infer<typeof browseQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.documents.listForPractice(
      query.practiceId,
      {
        category: query.category,
        patientId: query.patientId,
        q: query.q,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        cursor: query.cursor,
        limit: query.limit,
      },
      principal,
    );
  }

  @Get('patients/:patientId')
  @RequirePermissions(Permission.PATIENT_READ)
  listForPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query(zodBody(practiceQuery)) query: z.infer<typeof practiceQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.documents.listForPatient(query.practiceId, patientId, principal);
  }

  @Get('mine')
  listForUser(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.documents.listForUser(principal);
  }

  /**
   * Streams a stored file.
   *
   * Served with `Content-Disposition: attachment` and `nosniff` so the browser
   * downloads rather than renders it. Combined with the SVG/HTML denylist at
   * upload, this closes the stored-XSS path where an uploaded document is
   * served back as active content on the application's own origin.
   */
  @Get(':id/content')
  @RequirePermissions(Permission.PATIENT_READ)
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) query: z.infer<typeof practiceQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.documents.openForDownload(id, query.practiceId, principal);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    // Patient documents must never sit in a shared or disk cache.
    res.setHeader('Cache-Control', 'private, no-store');

    file.stream.pipe(res);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PATIENT_WRITE)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(practiceQuery)) query: z.infer<typeof practiceQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.documents.remove(id, query.practiceId, principal);
  }

  /** Renders the prescription for an encounter as a PDF. */
  @Get('prescriptions/:encounterId.pdf')
  @RequirePermissions(Permission.PRESCRIPTION_READ)
  async prescriptionPdf(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Query(zodBody(practiceQuery)) query: z.infer<typeof practiceQuery>,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, fileName } = await this.printouts.renderPrescription(
      query.practiceId,
      encounterId,
      principal,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.byteLength));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // `inline` so the doctor gets the browser's print preview directly.
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');

    res.end(buffer);
  }
}
