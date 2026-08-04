import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { AppConfigService } from '../../config/app.config';
import type { FileStorage, StoredFile } from '../../core/ports/services';

/**
 * Local-disk implementation of the `FileStorage` port.
 *
 * Intended for development and single-node deployments; the S3 adapter swaps in
 * behind the same interface without touching a service.
 *
 * The important property is that **the caller never chooses the path**. Keys are
 * generated from a UUID and validated against the storage root before any I/O,
 * so a crafted filename cannot escape the directory — the classic path
 * traversal that turns a file upload into arbitrary file write.
 */
@Injectable()
export class LocalFileStorage implements FileStorage {
  private readonly logger = new Logger(LocalFileStorage.name);
  private readonly root: string;

  constructor(config: AppConfigService) {
    this.root = resolve(process.cwd(), 'storage');
    void config;
  }

  async put(input: { key: string; body: Buffer; mimeType: string }): Promise<StoredFile> {
    const absolute = this.resolveWithinRoot(input.key);
    await mkdir(dirname(absolute), { recursive: true });

    // 0o600: readable only by the process owner. Uploaded material is patient
    // identification, not world-readable static content.
    await writeFile(absolute, input.body, { mode: 0o600 });

    return {
      storageKey: input.key,
      sizeBytes: input.body.byteLength,
      checksum: createHash('sha256').update(input.body).digest('hex'),
    };
  }

  /**
   * There is no public URL for stored files.
   *
   * Returning an opaque API path (rather than a filesystem location or a
   * pre-signed bucket URL) keeps every read behind the auth guard and the
   * tenancy check. Object storage would return a genuinely signed, expiring URL
   * here; the local driver relies on the download endpoint instead.
   */
  async signedUrl(storageKey: string, ttlSeconds: number): Promise<string> {
    void ttlSeconds;
    return `/documents/content/${encodeURIComponent(storageKey)}`;
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveWithinRoot(storageKey));
    } catch (error) {
      // A missing file is not an error worth failing a request over.
      this.logger.warn({ err: error, storageKey }, 'Failed to delete stored file');
    }
  }

  /** Streams a file for download without buffering it into memory. */
  openStream(storageKey: string): ReadStream {
    return createReadStream(this.resolveWithinRoot(storageKey));
  }

  /** Builds a collision-free key. Client filenames never reach the path. */
  buildKey(scope: string, extension: string): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const safeExt = extension.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
    return join(scope, String(yyyy), mm, `${randomUUID()}${safeExt ? `.${safeExt}` : ''}`);
  }

  /**
   * Resolves a key inside the storage root, rejecting anything that escapes.
   * Guards against `../`, absolute paths and symlink-style prefixes.
   */
  private resolveWithinRoot(key: string): string {
    const absolute = resolve(this.root, normalize(key));
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new Error('Resolved storage path escapes the storage root');
    }
    return absolute;
  }
}
