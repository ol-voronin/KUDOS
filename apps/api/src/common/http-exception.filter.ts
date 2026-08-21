import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode } from '@dt/contracts';

/**
 * Single error shape for every failure. Unhandled errors are logged with the
 * stack but answered with a generic message — internals never reach the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { correlationId?: string }>();
    const correlationId = req.correlationId ?? 'unknown';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

      res.status(status).json({
        statusCode: status,
        code: (payload['code'] as string) ?? ErrorCode.VALIDATION_FAILED,
        message: (payload['message'] as string) ?? exception.message,
        ...(payload['details'] ? { details: payload['details'] } : {}),
        correlationId,
      });
      return;
    }

    this.logger.error(
      `Unhandled error [${correlationId}] ${req.method} ${req.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL,
      message: 'Внутрішня помилка сервера',
      correlationId,
    });
  }
}
