import { z } from 'zod';

/** Every settings call names the practice it acts on. */
export const practiceQuery = z.object({ practiceId: z.string().uuid() });

/** Empty strings from a cleared form field mean "unset", not "save a blank". */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));
