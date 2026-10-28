import { Inject, Injectable } from '@nestjs/common';
import { DocumentCategory } from '@cura/shared';
import { AppConfigService } from '../../config/app.config';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/domain-error';
import {
  AUDIT_REPOSITORY,
  DOCUMENT_REPOSITORY,
  PATIENT_REPOSITORY,
  type AuditRepository,
  type DocumentRepository,
  type PatientRepository,
} from '../../core/ports/repositories';
import { LocalFileStorage } from '../../infrastructure/adapters/file-storage.adapter';
import type { AuthenticatedPrincipal } from '../../common/security/jwt-auth.guard';
import { detectFileType, isForbiddenType, sanitiseFileName } from './file-type.guard';

export interface UploadInput {
  buffer: Buffer;
  declaredMimeType: string;
  originalName: string;
  category: DocumentCategory;
  practiceId: string;
  patientId?: string | undefined;
  encounterId?: string | undefined;
}

/**
 * Document intake and retrieval.
 *
 * Upload is the highest-risk write in the system, so every accepted file has
 * passed four independent checks: size, forbidden-type denylist, magic-byte
 * detection, and agreement between the declared and detected type. Only then
 * does anything touch disk.
 */
@Injectable()
export class DocumentService {
  /** Categories that belong to the doctor's own profile, not to a patient. */
  private static readonly PROFILE_CATEGORIES: ReadonlySet<DocumentCategory> = new Set([
    DocumentCategory.NID_FRONT,
    DocumentCategory.NID_BACK,
    DocumentCategory.MEDICAL_CERTIFICATE,
    DocumentCategory.DIGITAL_SIGNATURE,
  ]);

  constructor(
    private readonly config: AppConfigService,
    private readonly crypto: CryptoService,
    private readonly storage: LocalFileStorage,
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
  ) {}

  async upload(input: UploadInput, principal: AuthenticatedPrincipal) {
    this.assertPractice(principal, input.practiceId);

    const limit = this.config.rules.uploads.maxFileBytes;
    if (input.buffer.byteLength === 0) {
      throw new ValidationError('The uploaded file is empty.');
    }
    if (input.buffer.byteLength > limit) {
      throw new ValidationError(
        `File is larger than the ${Math.round(limit / 1024 / 1024)} MB limit.`,
      );
    }

    if (isForbiddenType(input.declaredMimeType)) {
      throw new ValidationError('That file type is not accepted.');
    }

    // Magic-byte detection. The declared Content-Type is never trusted.
    const detected = detectFileType(input.buffer);
    if (!detected) {
      throw new ValidationError(
        'Unsupported file. Upload a JPEG, PNG, WebP image or a PDF.',
      );
    }

    const accepted = [
      ...this.config.rules.uploads.acceptedImageTypes,
      ...this.config.rules.uploads.acceptedDocumentTypes,
    ] as readonly string[];
    if (!accepted.includes(detected.mimeType)) {
      throw new ValidationError('That file type is not accepted.');
    }

    /**
     * The declared type must agree with the detected one. A mismatch is not a
     * harmless mistake — it is the signature of a file crafted to be treated as
     * one type on upload and another on read.
     */
    const declared = input.declaredMimeType.toLowerCase().split(';')[0]?.trim();
    if (declared && declared !== detected.mimeType && declared !== 'application/octet-stream') {
      throw new ValidationError('The file contents do not match its declared type.');
    }

    if (input.patientId) {
      const patient = await this.patients.findById(input.practiceId, input.patientId);
      if (!patient) throw new NotFoundError('Patient');
    } else if (!DocumentService.PROFILE_CATEGORIES.has(input.category)) {
      throw new ValidationError('This document category requires a patient.');
    }

    // Content-addressed de-duplication: re-uploading the same scan reuses the
    // stored object instead of writing a second copy.
    const checksum = this.crypto.sha256(input.buffer);
    const existing = await this.documents.findByChecksum(checksum);

    const storageKey =
      existing?.storageKey ??
      this.storage.buildKey(`practice-${input.practiceId}`, detected.extension);

    if (!existing) {
      await this.storage.put({
        key: storageKey,
        body: input.buffer,
        mimeType: detected.mimeType,
      });
    }

    const record = await this.documents.create({
      ownerUserId: input.patientId ? null : principal.userId,
      patientId: input.patientId ?? null,
      encounterId: input.encounterId ?? null,
      category: input.category,
      fileName: sanitiseFileName(input.originalName, detected.extension),
      mimeType: detected.mimeType,
      sizeBytes: input.buffer.byteLength,
      storageKey,
      checksum,
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'document.uploaded',
      resourceType: 'document',
      resourceId: record.id,
      practiceId: input.practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
      metadata: {
        category: input.category,
        mimeType: detected.mimeType,
        sizeBytes: input.buffer.byteLength,
        deduplicated: Boolean(existing),
      },
    });

    return {
      id: record.id,
      category: input.category,
      fileName: sanitiseFileName(input.originalName, detected.extension),
      mimeType: detected.mimeType,
      sizeBytes: input.buffer.byteLength,
      url: await this.storage.signedUrl(storageKey, 300),
    };
  }

  /**
   * Resolves a document for download.
   *
   * Access is re-checked here rather than relying on the opaqueness of the id:
   * a patient-scoped document is readable only by someone in that practice, and
   * a profile document only by its owner.
   */
  async openForDownload(id: string, practiceId: string, principal: AuthenticatedPrincipal) {
    this.assertPractice(principal, practiceId);

    const record = await this.documents.findById(id);
    if (!record) throw new NotFoundError('Document');

    if (record.patientId) {
      const patient = await this.patients.findById(practiceId, record.patientId);
      if (!patient) throw new ForbiddenError('This document belongs to another practice.');
    } else if (record.ownerUserId && record.ownerUserId !== principal.userId) {
      throw new ForbiddenError('This document belongs to another user.');
    }

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'document.downloaded',
      resourceType: 'document',
      resourceId: id,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
    });

    return {
      stream: this.storage.openStream(record.storageKey),
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    };
  }

  async listForPatient(practiceId: string, patientId: string, principal: AuthenticatedPrincipal) {
    this.assertPractice(principal, practiceId);
    const patient = await this.patients.findById(practiceId, patientId);
    if (!patient) throw new NotFoundError('Patient');
    return this.documents.listForPatient(patientId);
  }

  async listForUser(principal: AuthenticatedPrincipal) {
    return this.documents.listForOwner(principal.userId);
  }

  /** Practice-wide browse for the Documents module. */
  async listForPractice(
    practiceId: string,
    filter: {
      category?: DocumentCategory | undefined;
      patientId?: string | undefined;
      q?: string | undefined;
      from?: Date | undefined;
      to?: Date | undefined;
      cursor?: string | undefined;
      limit: number;
    },
    principal: AuthenticatedPrincipal,
  ) {
    this.assertPractice(principal, practiceId);

    if (filter.patientId) {
      // Resolving the patient first means a foreign id returns 404 rather than
      // an empty page, which would read as "this patient has no documents".
      const patient = await this.patients.findById(practiceId, filter.patientId);
      if (!patient) throw new NotFoundError('Patient');
    }

    return this.documents.listForPractice(practiceId, {
      ...filter,
      ownerUserId: principal.userId,
    });
  }

  /**
   * Removes a document from the practice's view.
   *
   * Reuses `openForDownload`'s access check by resolving the record the same
   * way: a caller who could not read the file must not be able to delete it.
   */
  async remove(id: string, practiceId: string, principal: AuthenticatedPrincipal) {
    this.assertPractice(principal, practiceId);

    const record = await this.documents.findById(id);
    if (!record) throw new NotFoundError('Document');

    if (record.patientId) {
      const patient = await this.patients.findById(practiceId, record.patientId);
      if (!patient) throw new ForbiddenError('This document belongs to another practice.');
    } else if (record.ownerUserId && record.ownerUserId !== principal.userId) {
      throw new ForbiddenError('This document belongs to another user.');
    }

    await this.documents.softDelete(id);
    await this.audit.record({
      actorUserId: principal.userId,
      action: 'document.deleted',
      resourceType: 'document',
      resourceId: id,
      practiceId,
      ipHash: null,
      userAgent: null,
      requestId: null,
      metadata: { fileName: record.fileName, category: record.category },
    });

    return { deleted: true };
  }

  private assertPractice(principal: AuthenticatedPrincipal, practiceId: string): void {
    if (!principal.practiceIds.includes(practiceId)) {
      throw new ForbiddenError('You do not have access to this practice.');
    }
  }
}
