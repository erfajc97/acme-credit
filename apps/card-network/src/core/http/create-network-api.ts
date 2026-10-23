import { createApp, setupOpenApi, type BaseEnv, type OpenApiOptions } from '@acme/nest-core';
import type { Type } from '@nestjs/common';
import { IdempotencyKey } from './idempotency-key';

/** The card network's OpenAPI document: served at `/docs` and exported to `docs/api/`. */
export const CARD_NETWORK_OPENAPI: OpenApiOptions = {
  title: 'Acme Credit — card network API',
  version: '1.0.0',
  description:
    'The simulated card network: in-wallet checkout, purchases and voids (forwarded to the ' +
    'lending core, signed), and the simulated payment provider (signed by the core) with its ' +
    'hosted pay page. Amounts are strings of integer cents. Every error is the `ErrorEnvelope`.',
  servers: [{ url: '/', description: 'This server' }],
  idempotencyKeyParams: [IdempotencyKey()],
};

/** The card network's bootstrap with its API docs, shared by main.ts and the tests (AN14). */
export async function createNetworkApi(
  module: Type<unknown>,
  env: Pick<BaseEnv, 'CORS_ORIGINS'> & Partial<Pick<BaseEnv, 'TRUST_PROXY'>>,
  options: { logger?: false } = {},
) {
  const app = await createApp(module, env, options);
  setupOpenApi(app, CARD_NETWORK_OPENAPI);
  return app;
}
