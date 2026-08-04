import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@cura/shared';
import { DomainError } from '../errors/domain-error';

/**
 * Single exit point for every error leaving the API.
 *
 * Two properties matter here:
 *  - Responses are uniform, so clients parse one shape.
 *  - Internal detail never escapes. Unexpected errors are logged in full
 *    server-side and returned to the caller as a generic message with a request
 *    id, so support can correlate without leaking stack traces, SQL or PHI.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId ?? 'unknown';

    const body = this.toBody(exception, requestId);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { requestId, path: request.url, method: request.method, err: exception },
        'Unhandled error',
      );
    } else if (body.statusCode === HttpStatus.UNAUTHORIZED || body.statusCode === HttpStatus.FORBIDDEN) {
      this.logger.warn({ requestId, path: request.url, code: body.code }, 'Access denied');
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, requestId: string): ApiErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        const key = issue.path.join('.') || '_';
        (details[key] ??= []).push(issue.message);
      }
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'VALIDATION_FAILED',
        message: 'The submitted data is invalid.',
        details,
        requestId,
        timestamp,
      };
    }

    if (exception instanceof DomainError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
        requestId,
        timestamp,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        code: this.codeForStatus(status),
        message: Array.isArray(message) ? message.join(', ') : message,
        requestId,
        timestamp,
      };
    }

    // Unknown failure: log-only detail, generic response.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      requestId,
      timestamp,
    };
  }

  private codeForStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_FAILED',
      429: 'RATE_LIMITED',
    };
    return map[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR');
  }
}
