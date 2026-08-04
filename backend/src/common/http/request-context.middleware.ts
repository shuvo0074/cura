import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Assigns every request a correlation id.
 *
 * The id flows into logs, audit rows and the error envelope, so a user can
 * report "request 3f2a…" and support can reconstruct exactly what happened
 * without the response ever having carried internal detail.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers['x-request-id'];
    const requestId =
      typeof inbound === 'string' && /^[\w-]{8,64}$/.test(inbound) ? inbound : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
