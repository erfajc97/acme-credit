import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { requestIdOf } from '../http/request-id';
import { mapError } from './error-envelope';

/** The one global filter (AN3): every error leaves as the A7 envelope with the request id. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const mapped = mapError(error, requestIdOf(request));

    if (mapped.unexpected) {
      this.logger.error({ err: error, requestId: mapped.envelope.requestId }, 'unexpected error');
    }

    response.status(mapped.status).json(mapped.envelope);
  }
}
