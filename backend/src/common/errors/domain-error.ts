import { HttpStatus } from '@nestjs/common';

/**
 * Errors the domain raises deliberately.
 *
 * Application services throw these instead of Nest HTTP exceptions, which keeps
 * the core layer free of transport concerns; the exception filter is the only
 * place that knows about HTTP. Messages here are written for end users.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number = HttpStatus.BAD_REQUEST,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} was not found.`, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, string[]>) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(message = 'Authentication is required.') {
    super('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class RateLimitedError extends DomainError {
  constructor(message = 'Too many attempts. Please try again later.') {
    super('RATE_LIMITED', message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, string[]>) {
    super('VALIDATION_FAILED', message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

/**
 * Deliberately vague authentication failure.
 *
 * Wrong password, unknown account and unverified account all produce this same
 * error so the endpoint cannot be used to enumerate which mobile numbers or
 * emails are registered.
 */
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('INVALID_CREDENTIALS', 'The credentials provided are incorrect.', HttpStatus.UNAUTHORIZED);
  }
}
