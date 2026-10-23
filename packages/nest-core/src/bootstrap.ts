import type { INestApplication, Provider, Type } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AccessGuard } from './auth/access.guard';
import type { BaseEnv } from './config/env';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';
import { noStoreMiddleware } from './http/no-store';
import { requestIdMiddleware } from './http/request-id';
import { ClientThrottlerGuard } from './http/throttle';

const JSON_BODY_LIMIT = '1mb';

/** Global pipe, guards (access → throttle, AN10) and the one filter (AN3), in order. */
export function globalProviders(): Provider[] {
  return [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: ClientThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ];
}

/** HTTP baseline (A5, A12, A15): request id first, then headers, body limit and CORS. */
type HttpEnv = Pick<BaseEnv, 'CORS_ORIGINS'> & Partial<Pick<BaseEnv, 'TRUST_PROXY'>>;

function configureApp(app: NestExpressApplication, env: HttpEnv): INestApplication {
  // Behind a proxy every request comes from the proxy: rate limits need the real client IP.
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestIdMiddleware);
  app.use(noStoreMiddleware);
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });
  app.enableShutdownHooks();
  return app;
}

/**
 * The one way to build a service (AN14): main.ts and the integration tests share it.
 * `rawBody` keeps the exact bytes so signed routes verify the HMAC before parsing (P3).
 */
export async function createApp(
  module: Type<unknown>,
  env: HttpEnv,
  options: { logger?: false } = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(module, {
    bufferLogs: true,
    bodyParser: false,
    rawBody: true,
    ...options,
  });
  configureApp(app, env);
  return app;
}
