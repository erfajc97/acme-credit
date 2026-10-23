import type { ArgumentsHost } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { AppHttpException } from '../app-http.exception';
import { AllExceptionsFilter } from '../all-exceptions.filter';

function setup() {
  const logger = { setContext: vi.fn(), error: vi.fn() };
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-filter-1' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter(logger as unknown as PinoLogger);
  return { filter, host, logger, status, json };
}

describe('AllExceptionsFilter', () => {
  it('writes the envelope with the request id and does not log expected errors', () => {
    const { filter, host, logger, status, json } = setup();
    filter.catch(new AppHttpException('common.not_found'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'common.not_found', requestId: 'req-filter-1' }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs an unexpected error once with the error and request id, and answers 500', () => {
    const { filter, host, logger, status, json } = setup();
    const error = new Error('boom');
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'common.internal', requestId: 'req-filter-1' }),
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      { err: error, requestId: 'req-filter-1' },
      'unexpected error',
    );
  });
});
