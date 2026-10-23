import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { Env } from '../config/env';
import { ENV } from '../config/env.provider';

/**
 * Bounds of every interactive transaction, set once. Waiting for a pooled connection is
 * allowed to take longer than Prisma's 2 s default, so a burst of writers on one card (the
 * 50-parallel test) queues instead of failing.
 */
export const TRANSACTION_DEFAULTS = { maxWait: 15_000, timeout: 20_000 } as const;

/** The app's only database client (AN4). Connects lazily, on the first query. */
@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor(@Inject(ENV) env: Env) {
    super({
      adapter: new PrismaPg({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: TRANSACTION_DEFAULTS.maxWait + 5_000,
        idleTimeoutMillis: 30_000,
      }),
      transactionOptions: TRANSACTION_DEFAULTS,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
