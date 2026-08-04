import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates and *replaces* the incoming payload with the parsed result.
 *
 * Two security properties follow from using the parsed output rather than the
 * raw body:
 *  - Unknown keys are stripped, so a client cannot smuggle extra fields into a
 *    later `create`/`update` call (mass-assignment).
 *  - Values arrive coerced and normalised (trimmed, lower-cased emails,
 *    canonical +880 mobiles), so downstream code never re-derives them.
 *
 * The schemas themselves come from `@cura/shared`, which is the same object the
 * clients validate against.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    // Throws ZodError, which the global filter renders as a 422 with
    // field-level details.
    return this.schema.parse(value);
  }
}

/** Convenience factory: `@Body(zodBody(loginSchema)) dto: LoginInput`. */
export const zodBody = <T>(schema: ZodSchema<T>) => new ZodValidationPipe(schema);
