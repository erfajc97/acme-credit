import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    testEnv: Record<string, string>;
  }
}

// Tests run from apps/api (pnpm --filter); the CLI is the package's own prisma dependency.
const PRISMA_CLI = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
const ROOT_ENV = '../../.env';

/** Postgres coordinates: CI env first, then the repo's local .env (never committed). */
function postgresSettings() {
  const fromFile = existsSync(ROOT_ENV) ? parseEnv(readFileSync(ROOT_ENV, 'utf8')) : {};
  const pick = (key: string, fallback?: string) => {
    const value = process.env[key] ?? fromFile[key] ?? fallback;
    if (value === undefined) throw new Error(`integration tests need ${key} (env or .env)`);
    return value;
  };
  return {
    host: pick('POSTGRES_HOST', 'localhost'),
    port: pick('POSTGRES_HOST_PORT', '5434'),
    user: pick('POSTGRES_USER'),
    password: pick('POSTGRES_PASSWORD'),
  };
}

const secret = () => randomBytes(32).toString('hex');

function run(label: string, args: string[], env: Record<string, string>) {
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`${label} failed:\n${result.stdout}\n${result.stderr}`);
}

/**
 * AN14: a throwaway database per run on the compose Postgres, migrated with the REAL
 * migrations and seeded with the REAL seed, dropped at teardown. Secrets are random per run.
 */
export default async function setup(project: TestProject) {
  const pg = postgresSettings();
  const credentials = `${encodeURIComponent(pg.user)}:${encodeURIComponent(pg.password)}`;
  const urlFor = (database: string) =>
    `postgresql://${credentials}@${pg.host}:${pg.port}/${database}`;
  const database = `acme_credit_test_${randomBytes(4).toString('hex')}`;
  const shadow = `${database}_shadow`;

  const admin = new Client({ connectionString: urlFor('postgres') });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  await admin.query(`CREATE DATABASE "${shadow}"`);

  const testEnv: Record<string, string> = {
    NODE_ENV: 'test',
    DATABASE_URL: urlFor(database),
    SHADOW_DATABASE_URL: urlFor(shadow),
    JWT_SECRET: secret(),
    NETWORK_SIGNING_SECRET: secret(),
    PROVIDER_SIGNING_SECRET: secret(),
    PROVIDER_API_SECRET: secret(),
    SEED_ADMIN_EMAIL: 'admin@acme.test',
    SEED_ADMIN_PASSWORD: secret(),
    SEED_CUSTOMER_EMAIL: 'demo@acme.test',
    SEED_CUSTOMER_PASSWORD: secret(),
  };
  run('prisma migrate deploy', [PRISMA_CLI, 'migrate', 'deploy'], testEnv);
  run('seed', ['-r', '@swc-node/register', 'src/seed.ts'], testEnv);
  project.provide('testEnv', testEnv);

  return async () => {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS "${shadow}" WITH (FORCE)`);
    await admin.end();
  };
}
