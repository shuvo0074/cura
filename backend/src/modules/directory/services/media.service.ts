import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PUBLIC_MEDIA, type PublicMediaStorage } from '../../../core/ports/public-media';
import { CLOCK, type Clock } from '../../../core/ports/services';
import { detectFileType } from '../../documents/file-type.guard';
import { DirectoryValidationError } from '../domain/errors';

export interface UploadedImage {
  buffer: Buffer;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Stores public images. The type and extension come from the bytes, not the client. */
@Injectable()
export class DirectoryMediaService {
  constructor(
    @Inject(PUBLIC_MEDIA) private readonly media: PublicMediaStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Each upload gets a new name, so browsers do not keep showing the old image. */
  async store(file: UploadedImage | undefined, folder: string, prefix: string): Promise<string> {
    const detected = file ? detectFileType(file.buffer) : null;
    if (!file || !detected || !IMAGE_TYPES.has(detected.mimeType)) {
      throw new DirectoryValidationError('Upload a JPEG, PNG or WebP image under 5 MB');
    }
    const unique = `${this.clock.now().getTime()}-${randomUUID().slice(0, 8)}`;
    return this.media.upload(`${folder}/${prefix}-${unique}.${detected.extension}`, file.buffer, detected.mimeType);
  }

  /** Only our own uploads are deleted; seeded images point at shared files. */
  async discard(path: string | null | undefined): Promise<void> {
    const objectName = this.media.objectNameFromPath(path);
    if (objectName) await this.media.delete(objectName);
  }

  open(objectName: string) {
    return this.media.open(objectName);
  }
}
