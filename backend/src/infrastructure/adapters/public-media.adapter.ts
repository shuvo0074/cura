import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { AppConfigService } from '../../config/app.config';
import type { PublicMediaStorage } from '../../core/ports/public-media';

const OBJECT_NAME = /^[a-z-]+\/[A-Za-z0-9._-]+$/;
const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Local-disk public media.
 *
 * The root is a sibling of the private document store, never inside it, so no
 * public route can reach a patient file. It needs a persistent disk in production.
 */
@Injectable()
export class LocalPublicMediaStorage implements PublicMediaStorage {
  readonly root = resolve(process.cwd(), 'storage-public');
  private readonly prefix: string;

  constructor(config: AppConfigService) {
    this.prefix = `/${config.apiPrefix}/directory/media/`;
  }

  async upload(objectName: string, body: Buffer): Promise<string> {
    const absolute = this.resolveObject(objectName);
    if (!absolute) throw new Error('Invalid media object name');
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, body, { mode: 0o644 });
    return `${this.prefix}${objectName}`;
  }

  async delete(objectName: string): Promise<void> {
    const absolute = this.resolveObject(objectName);
    if (!absolute) return;
    await unlink(absolute).catch(() => undefined);
  }

  async open(objectName: string) {
    const absolute = this.resolveObject(objectName);
    const mimeType = MIME_BY_EXTENSION[extname(objectName)];
    if (!absolute || !mimeType) return null;
    const found = await stat(absolute).then((info) => info.isFile(), () => false);
    return found ? { stream: createReadStream(absolute), mimeType } : null;
  }

  objectNameFromPath(path: string | null | undefined): string | null {
    return path?.startsWith(this.prefix) ? path.slice(this.prefix.length) : null;
  }

  /** The file for an object name, or null when the name could escape the root. */
  private resolveObject(objectName: string): string | null {
    if (!OBJECT_NAME.test(objectName) || objectName.includes('..')) return null;
    const absolute = resolve(this.root, objectName);
    return absolute.startsWith(this.root + sep) ? absolute : null;
  }
}
