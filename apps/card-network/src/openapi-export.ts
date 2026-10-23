import 'reflect-metadata';
import { buildOpenApiDocument, createApp } from '@acme/nest-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from './app.module';
import { loadEnvFromProcess } from './core/config/env.provider';
import { CARD_NETWORK_OPENAPI } from './core/http/create-network-api';

/**
 * Writes the card network's OpenAPI document to `docs/api/card-network.openapi.json`
 * (`pnpm --filter @acme/card-network openapi:export`). The app is built but never initialised
 * or listening: no background loop starts and nothing is called.
 */
async function main(): Promise<void> {
  const app = await createApp(AppModule, loadEnvFromProcess(), { logger: false });
  const document = buildOpenApiDocument(app, CARD_NETWORK_OPENAPI);
  const target = resolve(__dirname, '../../../docs/api/card-network.openapi.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  process.stdout.write(`wrote ${target}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`openapi export failed: ${String(error)}\n`);
  process.exit(1);
});
