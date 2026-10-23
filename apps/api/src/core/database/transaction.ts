import { AppHttpException } from '@acme/nest-core';
import { setTimeout as delay } from 'node:timers/promises';
import type { Prisma } from '../../generated/prisma/client';
import { sqlStateOf } from './db-errors';
import type { PrismaService } from './prisma.service';

export type Tx = Prisma.TransactionClient;

/** Serialization failure and deadlock: the transaction was rolled back and may run again. */
const RETRYABLE_SQLSTATES = new Set(['40001', '40P01']);
/** lock_timeout hit: another writer holds the account for too long (ADR-0003). */
const LOCK_NOT_AVAILABLE = '55P03';
/** Prisma could not start or finish the transaction in time (pool exhausted, timeout). */
const TRANSACTION_API_ERROR = 'P2028';

export const MAX_TRANSACTION_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 20;

export interface RetryOptions {
  sleep?: (ms: number) => Promise<unknown>;
  random?: () => number;
}

function isTransactionApiError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === TRANSACTION_API_ERROR
  );
}

/**
 * THE one way to run a money transaction (MO3): `lock_timeout = 3s` for every statement, and a
 * retry of the whole unit on a serialization failure or deadlock, 3 attempts with jitter. On
 * giving up, or when a lock cannot be taken in time, 409 `operation.in_progress`. The work must
 * be safe to re-run: it reads everything that decides inside the transaction (AN5).
 */
export async function runInTransaction<T>(
  prisma: Pick<PrismaService, '$transaction'>,
  work: (tx: Tx) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? delay;
  const random = options.random ?? Math.random;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
        return work(tx);
      });
    } catch (error) {
      if (isTransactionApiError(error)) throw new AppHttpException('operation.in_progress');
      const sqlState = sqlStateOf(error);
      if (sqlState === LOCK_NOT_AVAILABLE) throw new AppHttpException('operation.in_progress');
      if (sqlState === undefined || !RETRYABLE_SQLSTATES.has(sqlState)) throw error;
      if (attempt >= MAX_TRANSACTION_ATTEMPTS) throw new AppHttpException('operation.in_progress');
      await sleep(Math.round(BASE_BACKOFF_MS * attempt * (1 + random())));
    }
  }
}
