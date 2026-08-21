import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Every request carries an id through logs, audit rows and error responses so
 * that "it changed by itself" has one string to search for.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_HEADER);
    // Never trust a client-supplied id verbatim — it ends up in logs.
    const id = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    (req as Request & { correlationId: string }).correlationId = id;
    res.setHeader(CORRELATION_HEADER, id);
    next();
  }
}
