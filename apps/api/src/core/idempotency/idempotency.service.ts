import { AppHttpException } from '@acme/nest-core';
import type { ErrorCode } from '@acme/contracts';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { isUniqueViolation } from '../database/db-errors';
import { PrismaService } from '../database/prisma.service';
import { runInTransaction, type Tx } from '../database/transaction';
import { requestHash } from './request-hash';

/** What the `@IdempotentRequest()` decorator extracts from the HTTP request. */
export interface IdempotentRequest {
  key: string;
  method: string;
  path: string;
}

export interface IdempotencyContext extends IdempotentRequest {
  /** Who owns the key: a customer or admin id, or `network`. */
  scope: string;
  body: unknown;
}

/** The attempt that owns a PENDING key: only it may attach, complete or release the record. */
export interface IdempotencyClaim {
  recordId: string;
  attempt: number;
}

export type IdempotencyStart =
  | { kind: 'replay'; status: number; body: Prisma.JsonValue }
  | ({ kind: 'started'; resourceId: string | null } & IdempotencyClaim);

/**
 * How long a claimed key belongs to its attempt. Longer than any attempt can run (two
 * transactions bounded by TRANSACTION_DEFAULTS plus the 5 s provider timeout): once it lapses
 * the attempt is presumed dead and a retry with the same payload may take the key over.
 */
export const IDEMPOTENCY_LEASE_MS = 60_000;

/**
 * Errors that are a stable answer to the request and are replayed as such. Contention and
 * outages are not: the client retries them with the same key.
 */
const TRANSIENT_CODES: readonly ErrorCode[] = [
  'operation.in_progress',
  'idempotency.in_progress',
  'payment.provider_unavailable',
];

function isStoredError(
  body: Prisma.JsonValue,
): body is { code: ErrorCode; details?: Prisma.JsonObject } {
  return typeof body === 'object' && body !== null && !Array.isArray(body) && 'code' in body;
}

/** Turns a stored response back into what the handler returns (or throws). */
export function replayResponse<T>(start: { status: number; body: Prisma.JsonValue }): T {
  if (start.status >= 400 && isStoredError(start.body)) {
    throw new AppHttpException(start.body.code, start.body.details);
  }
  return start.body as T;
}

function leaseEnd(): Date {
  return new Date(Date.now() + IDEMPOTENCY_LEASE_MS);
}

/** The record as long as THIS attempt still owns it (a takeover bumps `attempt`). */
function owned(claim: IdempotencyClaim) {
  return { id: claim.recordId, attempt: claim.attempt, status: 'PENDING' as const };
}

/**
 * Idempotency keys stored in the SAME transaction as the effect (ADR-0004, MO2). A key is
 * claimed in its own short insert with a lease; the response is written with the effect; a
 * stable business error is stored too; a transient failure releases the key (or parks it as
 * RETRYABLE when the first attempt already created a resource, so the retry resumes it instead
 * of duplicating it). A key whose attempt crashed is taken over once its lease lapses; every
 * write of the record is conditional on the attempt, so a stale attempt can never commit.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async begin(context: IdempotencyContext): Promise<IdempotencyStart> {
    const hash = requestHash(context);
    try {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          scope: context.scope,
          key: context.key,
          requestHash: hash,
          lockedUntil: leaseEnd(),
        },
        select: { id: true },
      });
      return { kind: 'started', recordId: created.id, attempt: 1, resourceId: null };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return this.resumeExisting(context, hash);
  }

  /** Records the resource the first attempt created, in the transaction that created it. */
  async attachResource(tx: Tx, claim: IdempotencyClaim, resourceId: string): Promise<void> {
    const updated = await tx.idempotencyKey.updateMany({
      where: owned(claim),
      data: { resourceId },
    });
    assertStillOwned(updated.count);
  }

  /**
   * Stores the response inside the effect's transaction. If another attempt took the key over,
   * it throws, which rolls the effect back: the effect commits at most once per key.
   */
  async complete(
    tx: Tx,
    claim: IdempotencyClaim,
    status: number,
    body: Prisma.InputJsonValue,
  ): Promise<void> {
    const updated = await tx.idempotencyKey.updateMany({
      where: owned(claim),
      data: { status: 'COMPLETED', responseStatus: status, responseBody: body },
    });
    assertStillOwned(updated.count);
  }

  /** After a failed attempt: store a stable business error, release anything else. */
  async fail(claim: IdempotencyClaim, error: unknown): Promise<void> {
    if (error instanceof AppHttpException && !TRANSIENT_CODES.includes(error.code)) {
      const body: Prisma.InputJsonObject = error.details
        ? { code: error.code, details: error.details as Prisma.InputJsonObject }
        : { code: error.code };
      await this.prisma.idempotencyKey.updateMany({
        where: owned(claim),
        data: { status: 'COMPLETED', responseStatus: error.status, responseBody: body },
      });
      return;
    }
    const record = await this.prisma.idempotencyKey.findUnique({
      where: { id: claim.recordId },
      select: { resourceId: true },
    });
    if (record?.resourceId) {
      await this.prisma.idempotencyKey.updateMany({
        where: owned(claim),
        data: { status: 'RETRYABLE' },
      });
      return;
    }
    await this.prisma.idempotencyKey.deleteMany({ where: owned(claim) });
  }

  /** The common case: one transaction does the effect and stores its response. */
  async execute<T extends Prisma.InputJsonValue>(
    context: IdempotencyContext,
    status: number,
    effect: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    const start = await this.begin(context);
    if (start.kind === 'replay') return replayResponse<T>(start);
    try {
      return await runInTransaction(this.prisma, async (tx) => {
        const result = await effect(tx);
        await this.complete(tx, start, status, result);
        return result;
      });
    } catch (error) {
      await this.fail(start, error);
      throw error;
    }
  }

  private async resumeExisting(
    context: IdempotencyContext,
    hash: string,
  ): Promise<IdempotencyStart> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { scope_key: { scope: context.scope, key: context.key } },
      select: {
        id: true,
        requestHash: true,
        status: true,
        resourceId: true,
        responseStatus: true,
        responseBody: true,
        attempt: true,
        lockedUntil: true,
      },
    });
    // Released between our insert and this read: the client retries and claims it afresh.
    if (!existing) throw new AppHttpException('idempotency.in_progress');
    if (existing.requestHash !== hash) throw new AppHttpException('idempotency.key_reused');
    if (existing.status === 'COMPLETED' && existing.responseStatus !== null) {
      return { kind: 'replay', status: existing.responseStatus, body: existing.responseBody };
    }
    const next = existing.attempt + 1;
    const resumable = takeoverFilter(existing, new Date());
    if (resumable) {
      const claimed = await this.prisma.idempotencyKey.updateMany({
        where: resumable,
        data: {
          ...(existing.status === 'RETRYABLE' ? { status: 'PENDING' as const } : {}),
          attempt: next,
          lockedUntil: leaseEnd(),
        },
      });
      if (claimed.count === 1) {
        return {
          kind: 'started',
          recordId: existing.id,
          attempt: next,
          resourceId: existing.resourceId,
        };
      }
    }
    throw new AppHttpException('idempotency.in_progress');
  }
}

/**
 * The conditional `where` under which a retry may own the key: RETRYABLE (the last attempt
 * failed cleanly) or PENDING past its lease (the attempt died). Null while a live attempt owns it.
 */
function takeoverFilter(
  existing: {
    id: string;
    status: 'PENDING' | 'RETRYABLE' | 'COMPLETED';
    attempt: number;
    lockedUntil: Date;
  },
  now: Date,
): Prisma.IdempotencyKeyWhereInput | null {
  const base = { id: existing.id, attempt: existing.attempt };
  if (existing.status === 'RETRYABLE') return { ...base, status: 'RETRYABLE' };
  if (existing.status === 'PENDING' && existing.lockedUntil <= now) {
    return { ...base, status: 'PENDING', lockedUntil: { lte: now } };
  }
  return null;
}

/** Another attempt owns the key now (its lease lapsed and a retry took it over). */
function assertStillOwned(count: number): void {
  if (count !== 1) throw new AppHttpException('idempotency.in_progress');
}
