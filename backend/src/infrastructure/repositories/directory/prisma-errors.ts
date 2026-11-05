import { Prisma } from '@prisma/client';

/** The fields of a unique-constraint violation, or null for any other error. */
export function uniqueViolationFields(error: unknown): string[] | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = error.meta?.target;
    return Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  }
  return null;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

/** Update or delete on a row that does not exist. */
export function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Runs a write on one row, returning null when the row does not exist. */
export async function orNull<T>(write: Promise<T>): Promise<T | null> {
  try {
    return await write;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
