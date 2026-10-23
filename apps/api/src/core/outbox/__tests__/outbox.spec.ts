import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, sqlOf, type FakeDb } from '../../__tests__/fake-db';
import { PollingLoop } from '../../worker/polling-loop';
import { WorkerRunner } from '../../worker/worker-runner.service';
import { backoffMs, MAX_OUTBOX_ATTEMPTS, OutboxRelay, type ClaimedEvent } from '../outbox-relay';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const event = (overrides: Partial<ClaimedEvent> = {}): ClaimedEvent => ({
  id: 'e1',
  type: 'payout.requested',
  payload: { entityId: 'p1' },
  attempts: 1,
  ...overrides,
});

describe('OutboxRelay (P2)', () => {
  let db: FakeDb;
  let relay: OutboxRelay;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db = fakeDb();
    relay = new OutboxRelay(db as never);
  });
  afterEach(() => vi.useRealTimers());

  it('backs off exponentially, capped at 5 minutes', () => {
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(3)).toBe(8_000);
    expect(backoffMs(8)).toBe(256_000);
    expect(backoffMs(9)).toBe(300_000);
  });

  it('claims with SKIP LOCKED, under the attempt cap', async () => {
    db.$queryRaw.mockResolvedValue([event()]);
    await expect(relay.claimBatch(5)).resolves.toEqual([event()]);
    const sql = sqlOf(db.$queryRaw.mock.calls[0]);
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('attempts < ?');
    expect(db.$queryRaw.mock.calls[0]?.slice(1)).toEqual([60, MAX_OUTBOX_ATTEMPTS, 5]);
  });

  it('dispatches by type, acknowledges events nobody consumes, and reschedules failures', async () => {
    db.$queryRaw.mockResolvedValue([
      event({ id: 'e1' }),
      event({ id: 'e2', type: 'account.opened' }),
      event({ id: 'e3', attempts: 2 }),
    ]);
    const handle = vi.fn(async (item: ClaimedEvent) => {
      if (item.id === 'e3') throw new Error('provider down');
    });
    await expect(relay.processBatch([{ type: 'payout.requested', handle }])).resolves.toBe(3);
    expect(handle).toHaveBeenCalledTimes(2);
    expect(db.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { processedAt: NOW, lastError: null },
      select: { id: true },
    });
    expect(db.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e2' }, data: { processedAt: NOW, lastError: null } }),
    );
    expect(db.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'e3' },
      data: { lastError: 'Error: provider down', availableAt: new Date(NOW.getTime() + 4_000) },
      select: { id: true },
    });
  });

  it('reports the final failure as an error and keeps the message short', async () => {
    const logged = vi.spyOn(
      (relay as unknown as { logger: { error: () => void } }).logger,
      'error',
    );
    await relay.fail(event({ attempts: MAX_OUTBOX_ATTEMPTS }), 'x'.repeat(900));
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'e1', attempts: MAX_OUTBOX_ATTEMPTS }),
      'outbox event gave up',
    );
    const data = db.outboxEvent.update.mock.calls[0]?.[0] as { data: { lastError: string } };
    expect(data.data.lastError).toHaveLength(500);
  });
});

describe('PollingLoop and WorkerRunner (A10)', () => {
  it('ticks until stopped, logs a failing tick and keeps going', async () => {
    const logger = { error: vi.fn() };
    let ticks = 0;
    const loop = new PollingLoop({
      name: 'test',
      intervalMs: 1,
      logger,
      tick: async () => {
        ticks += 1;
        if (ticks === 1) throw new Error('first tick fails');
      },
    });
    loop.start();
    loop.start();
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(3));
    await loop.stop();
    const after = ticks;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ticks).toBe(after);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ loop: 'test' }),
      'worker tick failed',
    );
  });

  it('stops a sleeping loop at once', async () => {
    const loop = new PollingLoop({
      name: 'slow',
      intervalMs: 60_000,
      logger: { error: vi.fn() },
      tick: async () => 1,
    });
    loop.start();
    const started = Date.now();
    await loop.stop();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('runs the outbox loop and every periodic job between bootstrap and shutdown', async () => {
    const relay = { processBatch: vi.fn(async () => 0) };
    const job = { name: 'sweep', intervalMs: 60_000, run: vi.fn(async () => 0) };
    const runner = new WorkerRunner(relay as never, [], [job]);
    runner.onApplicationBootstrap();
    await vi.waitFor(() => expect(job.run).toHaveBeenCalled());
    await runner.onApplicationShutdown();
    expect(relay.processBatch).toHaveBeenCalledWith([]);
  });
});
