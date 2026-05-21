import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Filter global de exceções.
 * - Erros HttpException nativos: respeita statusCode + payload.
 * - Demais: 500 com payload sanitizado.
 *
 * Sempre loga com correlation hint (tenantId + userId quando disponíveis).
 * NUNCA loga req.body bruto (RULES 8.5 — pode conter senha, token).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { user?: { sub?: string; tid?: string } }>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      statusCode: status,
      error: 'Internal Server Error',
      message: 'Erro inesperado.',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body =
        typeof resp === 'object' && resp !== null
          ? (resp as Record<string, unknown>)
          : { statusCode: status, message: String(resp) };
    }

    this.logger.error({
      msg: 'request_error',
      status,
      method: req.method,
      path: req.url,
      userId: req.user?.sub,
      tenantId: req.user?.tid,
      err:
        exception instanceof Error
          ? { name: exception.name, message: exception.message, stack: exception.stack }
          : { value: String(exception) },
    });

    res.status(status).json(body);
  }
}
