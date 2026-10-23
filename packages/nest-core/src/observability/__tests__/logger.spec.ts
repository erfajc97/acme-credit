import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import {
  loggerParams,
  REDACT_CENSOR,
  REDACT_PATHS,
  serializeRequest,
  serializeResponse,
} from '../logger';

type HttpOptions = {
  level: string;
  redact: { paths: string[]; censor: string };
  customProps: (request: { id: string }) => unknown;
  autoLogging: { ignore: (request: { url: string }) => boolean };
};

function httpOptions(env: Parameters<typeof loggerParams>[0]): HttpOptions {
  return loggerParams(env).pinoHttp as unknown as HttpOptions;
}

describe('loggerParams', () => {
  it('silences logs in tests and keeps the level elsewhere', () => {
    expect(httpOptions({ NODE_ENV: 'test', LOG_LEVEL: 'debug' }).level).toBe('silent');
    expect(httpOptions({ NODE_ENV: 'development', LOG_LEVEL: 'debug' }).level).toBe('debug');
  });

  it('tags every line with the request id and skips health checks', () => {
    const http = httpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    expect(http.customProps({ id: 'r-9' })).toEqual({ requestId: 'r-9' });
    expect(http.autoLogging.ignore({ url: '/health' })).toBe(true);
    expect(http.autoLogging.ignore({ url: '/v1/accounts' })).toBe(false);
  });

  it('redacts exactly the credential paths with the censor', () => {
    const http = httpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    expect(http.redact).toEqual({
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-signature"]',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.refreshToken',
      ],
      censor: '[redacted]',
    });
  });

  it('really redacts secrets in an emitted line', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pino({ redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR } }, sink);
    logger.info({
      req: { headers: { authorization: 'Bearer abc', cookie: 'sid=1', 'x-signature': 'sig' } },
      body: { password: 'hunter2', token: 'tok', refreshToken: 'ref', passwordHash: 'h' },
    });
    const line = lines.join('');
    for (const secret of ['Bearer abc', 'sid=1', '"sig"', 'hunter2', '"tok"', '"ref"', '"h"']) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain(REDACT_CENSOR);
  });
});

describe('loggerParams wiring', () => {
  it('uses the PII-free serializers', () => {
    const http = loggerParams({ NODE_ENV: 'production', LOG_LEVEL: 'info' })
      .pinoHttp as unknown as {
      serializers: Record<string, unknown>;
    };
    expect(http.serializers).toEqual({ req: serializeRequest, res: serializeResponse });
  });
});

describe('serializers', () => {
  it('keep only id, method and path of a request: no IP, user agent or query', () => {
    expect(serializeRequest({ id: 'r-1', method: 'GET', url: '/v1/accounts?email=a@b.c' })).toEqual(
      { id: 'r-1', method: 'GET', path: '/v1/accounts' },
    );
    expect(serializeRequest({})).toEqual({ id: undefined, method: undefined, path: undefined });
  });

  it('keep only the status of a response', () => {
    expect(serializeResponse({ statusCode: 201 })).toEqual({ statusCode: 201 });
  });
});
