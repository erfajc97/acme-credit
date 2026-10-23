import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface ClaimedEvent {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
}

/** A consumer of one outbox event type. Handlers must be idempotent: an event can run twice. */
export interface OutboxHandler {
  readonly type: string;
  handle(event: ClaimedEvent): Promise<void>;
}

export const OUTBOX_HANDLERS = Symbol('OUTBOX_HANDLERS');

export const MAX_OUTBOX_ATTEMPTS = 8;
/** A claimed event is invisible to other workers for this long; a crash makes it visible again. */
export const CLAIM_LEASE_MS = 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const LAST_ERROR_MAX = 500;

/** 2 s, 4 s, 8 s … capped at 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(1_000 * 2 ** attempts, MAX_BACKOFF_MS);
}

/**
 * Transactional outbox reader (P2). Claiming is ONE statement: rows are picked with
 * `FOR UPDATE SKIP LOCKED` (parallel workers never take the same row), their attempt counter
 * is bumped and they are leased. Handling runs outside any transaction; success marks the row
 * processed, failure reschedules it with backoff until the attempts run out.
 */
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);

  constructor(private readonly prisma: PrismaService) {}

  claimBatch(limit: number): Promise<ClaimedEvent[]> {
    return this.prisma.$queryRaw<ClaimedEvent[]>`
      UPDATE outbox_events
         SET attempts = attempts + 1,
             available_at = now() + make_interval(secs => ${CLAIM_LEASE_MS / 1000})
       WHERE id IN (
         SELECT id FROM outbox_events
          WHERE processed_at IS NULL
            AND available_at <= now()
            AND attempts < ${MAX_OUTBOX_ATTEMPTS}
          ORDER BY created_at, id
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED)
      RETURNING id::text AS id, type, payload, attempts`;
  }

  async complete(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), lastError: null },
      select: { id: true },
    });
  }

  async fail(event: ClaimedEvent, error: unknown): Promise<void> {
    const message = (
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    ).slice(0, LAST_ERROR_MAX);
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        lastError: message,
        availableAt: new Date(Date.now() + backoffMs(event.attempts)),
      },
      select: { id: true },
    });
    const finalAttempt = event.attempts >= MAX_OUTBOX_ATTEMPTS;
    this.logger[finalAttempt ? 'error' : 'warn'](
      { eventId: event.id, type: event.type, attempts: event.attempts, error: message },
      finalAttempt ? 'outbox event gave up' : 'outbox event failed, will retry',
    );
  }

  /** One pass: claim, dispatch by type, record the outcome. Returns how many were claimed. */
  async processBatch(handlers: readonly OutboxHandler[], limit = 10): Promise<number> {
    const events = await this.claimBatch(limit);
    for (const event of events) {
      const handler = handlers.find((candidate) => candidate.type === event.type);
      try {
        // Events nobody consumes (audit trail of state changes) are simply acknowledged.
        if (handler) await handler.handle(event);
        await this.complete(event.id);
      } catch (error) {
        await this.fail(event, error);
      }
    }
    return events.length;
  }
}
