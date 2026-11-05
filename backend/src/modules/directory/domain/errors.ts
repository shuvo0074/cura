import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../common/errors/domain-error';

/** A rejected directory input: 400 with code VALIDATION, the directory's contract. */
export class DirectoryValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION', message, HttpStatus.BAD_REQUEST);
  }
}

/** A directory failure with a machine code the frontend branches on. */
export class DirectoryError extends DomainError {
  constructor(status: number, code: string, message: string, extra?: Record<string, unknown>) {
    super(code, message, status, undefined, extra);
  }
}

export const directoryNotFound = (what: string) =>
  new DirectoryError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} not found`);

/** Delete refused because something still depends on the record. */
export const dependantsExist = (message: string) =>
  new DirectoryError(HttpStatus.CONFLICT, 'HAS_DEPENDANTS', message);
