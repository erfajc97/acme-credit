import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadSeedEnvFromProcess } from './core/config/env.provider';
import { PrismaService } from './core/database/prisma.service';
import { UsersSeeder } from './modules/auth/users.seeder';
import { DemoDataSeeder } from './modules/demo/demo-data.seeder';
import { SeedModule } from './seed.module';

/**
 * Third entrypoint: `node dist/seed.js` after `prisma migrate deploy`. It lives in src/ (not
 * prisma/seed.ts) so it compiles with the app and reuses its env schema, client and hasher.
 */
async function main(): Promise<void> {
  const seedEnv = loadSeedEnvFromProcess();
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await app.get(UsersSeeder).seed(seedEnv);
    // The demo history exists only where the demo customer does (never in production unless
    // SEED_DEMO_CUSTOMER=true, the guard of seedEnvSchema).
    if (seedEnv.customer) {
      const customer = await app.get(PrismaService).user.findUniqueOrThrow({
        where: { email: seedEnv.customer.email.trim().toLowerCase() },
        select: { id: true },
      });
      await app.get(DemoDataSeeder).seed(customer.id);
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`seed failed: ${String(error)}\n`);
  process.exit(1);
});
