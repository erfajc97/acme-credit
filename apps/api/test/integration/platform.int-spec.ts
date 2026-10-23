import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sqlStateOf } from '../../src/core/database/db-errors';
import { OutboxRelay } from '../../src/core/outbox/outbox-relay';
import { startHarness, testEnv, type Harness } from './support/harness';

// Tests run from apps/api (pnpm --filter); the CLI is the package's own prisma dependency.
const PRISMA_CLI = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');

const CHECK_VIOLATION = '23514';

async function sqlStateOfRejection(promise: Promise<unknown>): Promise<string | undefined> {
  const error: unknown = await promise.then(
    () => undefined,
    (rejection: unknown) => rejection,
  );
  return sqlStateOf(error);
}

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.close();
});

describe('migrations (AN8)', () => {
  it('replaying every migration yields exactly schema.prisma (drift test)', () => {
    const result = spawnSync(
      process.execPath,
      [
        PRISMA_CLI,
        'migrate',
        'diff',
        '--from-migrations',
        'prisma/migrations',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      { encoding: 'utf8', env: process.env },
    );
    expect(result.stdout + result.stderr).toContain('No difference detected');
    expect(result.status).toBe(0);
  });
});

describe('ledger balance constraint (ADR-0002, DB half)', () => {
  it('rejects at commit an entry whose postings do not sum to zero', async () => {
    const attempt = h.db.$transaction(async (tx) => {
      await tx.journalEntry.create({
        data: {
          kind: 'repayment',
          description: 'unbalanced on purpose',
          postings: {
            createMany: {
              data: [
                { ledgerAccount: 'cash_clearing', amountCents: 100n },
                { ledgerAccount: 'merchant_settlement', amountCents: -99n },
              ],
            },
          },
        },
      });
    });
    expect(await sqlStateOfRejection(attempt)).toBe(CHECK_VIOLATION);
    expect(await h.db.journalEntry.count({ where: { description: 'unbalanced on purpose' } })).toBe(
      0,
    );
  });

  it('accepts a balanced entry, and an entry with a single posting is rejected', async () => {
    await h.db.journalEntry.create({
      data: {
        kind: 'repayment',
        description: 'balanced on purpose',
        postings: {
          createMany: {
            data: [
              { ledgerAccount: 'cash_clearing', amountCents: 100n },
              { ledgerAccount: 'merchant_settlement', amountCents: -100n },
            ],
          },
        },
      },
    });
    expect(await h.db.journalEntry.count({ where: { description: 'balanced on purpose' } })).toBe(
      1,
    );
    const lonely = h.db.journalEntry.create({ data: { kind: 'repayment', description: 'lonely' } });
    expect(await sqlStateOfRejection(lonely)).toBe(CHECK_VIOLATION);
  });

  it('keeps the journal append-only', async () => {
    const posting = await h.db.posting.findFirstOrThrow({ select: { id: true } });
    const rewrite = h.db.posting.update({ where: { id: posting.id }, data: { amountCents: 1n } });
    expect(await sqlStateOfRejection(rewrite)).toBe(CHECK_VIOLATION);
  });

  it('keeps balances non-negative and within the limit (CHECKs)', async () => {
    const user = await h.db.user.create({
      data: { email: 'checks@acme.test', passwordHash: 'x', fullName: 'Checks', role: 'customer' },
    });
    const overLimit = h.db.account.create({
      data: { customerId: user.id, status: 'ACTIVE', creditLimitCents: 100n, heldCents: 101n },
    });
    expect(await sqlStateOfRejection(overLimit)).toBe(CHECK_VIOLATION);
    const ok = await h.db.account.create({
      data: { customerId: user.id, status: 'ACTIVE', creditLimitCents: 100n, heldCents: 100n },
    });
    expect(ok.heldCents).toBe(100n);
  });
});

describe('transactional outbox (P2)', () => {
  // The run database is shared by every spec file: events left pending by earlier files would
  // fill claimBatch(100) and hide this test's own event, so they are drained first.
  beforeEach(async () => {
    await h.db.outboxEvent.updateMany({
      where: { processedAt: null },
      data: { processedAt: new Date() },
    });
  });

  it('re-delivers an event once when the worker crashed between claim and done', async () => {
    const event = await h.db.outboxEvent.create({
      data: { type: 'test.crash', payload: { entityId: 'x' } },
      select: { id: true },
    });
    const first = await relayFor(h).claimBatch(100);
    expect(first.map((item) => item.id)).toContain(event.id);
    // Crash: never completed. Nobody else sees it while the lease holds…
    expect((await relayFor(h).claimBatch(100)).map((item) => item.id)).not.toContain(event.id);
    // …and once the lease expires it comes back, exactly once more.
    await h.db.outboxEvent.update({ where: { id: event.id }, data: { availableAt: new Date(0) } });
    const handled: string[] = [];
    await relayFor(h).processBatch([
      { type: 'test.crash', handle: async (item) => void handled.push(item.id) },
    ]);
    expect(handled).toEqual([event.id]);
    const done = await h.db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(done.processedAt).not.toBeNull();
    expect(done.attempts).toBe(2);
  });

  it('reschedules a failing event with its last error', async () => {
    const event = await h.db.outboxEvent.create({
      data: { type: 'test.failing', payload: {} },
      select: { id: true },
    });
    await relayFor(h).processBatch([
      {
        type: 'test.failing',
        handle: async () => {
          throw new Error('provider down');
        },
      },
    ]);
    const row = await h.db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(row.processedAt).toBeNull();
    expect(row.lastError).toBe('Error: provider down');
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('uses the run database (sanity)', () => {
    expect(testEnv('DATABASE_URL')).toContain('acme_credit_test_');
  });
});

/** The worker's relay over the test database (the API process does not run it). */
function relayFor(harness: Harness): OutboxRelay {
  return new OutboxRelay(harness.db as never);
}
