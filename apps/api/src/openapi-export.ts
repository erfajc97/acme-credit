import 'reflect-metadata';
import { buildOpenApiDocument, createApp } from '@acme/nest-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from './app.module';
import { loadEnvFromProcess } from './core/config/env.provider';
import { LENDING_CORE_OPENAPI } from './core/http/create-api';

/**
 * Writes the lending core's OpenAPI document to `docs/api/lending-core.openapi.json`
 * (`pnpm --filter @acme/api openapi:export`). The app is built but never initialised
 * or listening: no background loop starts and nothing is called.
 */
async function main(): Promise<void> {
  const app = await createApp(AppModule, loadEnvFromProcess(), { logger: false });
  const document = buildOpenApiDocument(app, LENDING_CORE_OPENAPI);
  const target = resolve(__dirname, '../../../docs/api/lending-core.openapi.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  process.stdout.write(`wrote ${target}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`openapi export failed: ${String(error)}\n`);
  process.exit(1);
});
