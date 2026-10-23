import { createApp, setupOpenApi, type BaseEnv, type OpenApiOptions } from '@acme/nest-core';
import type { Type } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { IdempotentRequest } from './request-context';

/** The lending core's OpenAPI document: served at `/docs` and exported to `docs/api/`. */
export const LENDING_CORE_OPENAPI: OpenApiOptions = {
  title: 'Acme Credit — lending core API',
  version: '1.0.0',
  description:
    'Secured credit card: accounts, collateral deposits, repayments, payouts, card ' +
    'authorizations (signed by the card network) and the admin back office. Amounts are ' +
    'strings of integer cents. Every error is the `ErrorEnvelope`; clients branch on `code`.',
  servers: [{ url: '/', description: 'This server' }],
  idempotencyKeyParams: [IdempotentRequest()],
};

/**
 * The lending core's bootstrap, shared by main.ts and the integration tests (AN14): the shared
 * nest-core pipeline, the cookie parser the refresh-token cookie needs, and the API docs.
 */
export async function createApi(
  module: Type<unknown>,
  env: Pick<BaseEnv, 'CORS_ORIGINS'> & Partial<Pick<BaseEnv, 'TRUST_PROXY'>>,
  options: { logger?: false } = {},
) {
  const app = await createApp(module, env, options);
  app.use(cookieParser());
  setupOpenApi(app, LENDING_CORE_OPENAPI);
  return app;
}
