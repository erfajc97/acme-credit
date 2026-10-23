import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Local runs (`pnpm --filter @acme/api db:migrate`) read the repo's .env; containers and CI pass
// the variables explicitly, so the file is only a fallback when DATABASE_URL is not set.
const LOCAL_ENV_FILE = '../../.env';
if (!process.env.DATABASE_URL && existsSync(LOCAL_ENV_FILE)) process.loadEnvFile(LOCAL_ENV_FILE);

// `prisma generate` needs no database, so the URL may be empty; migrate commands fail loudly.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
