import type { Params } from 'nestjs-pino';

/** Never log credentials or session material (A15). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-signature"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
] as const;

export const REDACT_CENSOR = '[redacted]';

export interface LoggerEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

/** Request lines keep ids and routes only: no IP, user agent or query string (A15, PII). */
export function serializeRequest(request: { id?: unknown; method?: string; url?: string }) {
  return { id: request.id, method: request.method, path: request.url?.split('?')[0] };
}

export function serializeResponse(response: { statusCode?: number }) {
  return { statusCode: response.statusCode };
}

/** pino-http reuses `req.id`, set first by requestIdMiddleware (see bootstrap). */
export function loggerParams(env: LoggerEnv): Params {
  return {
    pinoHttp: {
      level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
      redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR },
      serializers: { req: serializeRequest, res: serializeResponse },
      customProps: (request) => ({ requestId: request.id }),
      autoLogging: { ignore: (request) => request.url === '/health' },
    },
  };
}
