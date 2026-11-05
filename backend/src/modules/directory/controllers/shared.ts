import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Row } from '../../../core/ports/directory.ports';
import { DirectoryValidationError } from '../domain/errors';

/** The form field for image uploads. Bytes are checked after the size cap. */
export const PhotoUpload = () =>
  FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 } });

/** Public pages behind a shared mobile connection make many requests per IP. */
export const PublicReadLimit = () => Throttle({ default: { limit: 600, ttl: 60_000 } });

/** One address cannot pump a doctor's reach numbers. */
export const ReachLimit = () => Throttle({ default: { limit: 120, ttl: 3_600_000 } });

export const RegisterLimit = () => Throttle({ default: { limit: 10, ttl: 3_600_000 } });

export function bodyOf(body: unknown): Row {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Row) : {};
}

export function hiddenFlag(body: unknown): boolean {
  const hidden = bodyOf(body).hidden;
  if (typeof hidden !== 'boolean') throw new DirectoryValidationError('hidden must be true or false');
  return hidden;
}
