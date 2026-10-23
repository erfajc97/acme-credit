import { AppHttpException } from '@acme/nest-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, sqlOf, type FakeDb } from '../../../core/__tests__/fake-db';
import { SYSTEM_ACTOR } from '../../../core/audit/record-change';
import {
  MAX_PAYOUT_ATTEMPTS,
  PAYOUT_CLAIM_LEASE_MS,
  payoutOutcome,
  payoutRetryDelayMs,
} from '../helpers/payout-rules';
import { PayoutsRepository } from '../payouts.repository';
import { PayoutsService } from '../payouts.service';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const REF_1 = '0199a000-0000-7000-8000-000000000001';
const CLAIMED = {
  id: 'p1',
  accountId: 'a1',
  amountCents: 12_450n,
  providerReference: REF_1,
};
const STORED = { ...CLAIMED, status: 'PENDING' as const, attempts: 1 };
const payment = (fields: Record<string, unknown> = {}) => ({
  id: 'pay_9',
  reference: REF_1,
  amountCents: '12450',
  purpose: 'payout' as const,
  status: 'SUCCEEDED' as const,
  approveUrl: 'http://provider.test/pay/pay_9',
  createdAt: NOW.toISOString(),
  settledAt: NOW.toISOString(),
  ...fields,
});

describe('payout rules', () => {
  it('retries a failed attempt with growing backoff, capped', () => {
    expect(payoutRetryDelayMs(1)).toBe(30_000);
    expect(payoutRetryDelayMs(2)).toBe(60_000);
    expect(payoutRetryDelayMs(3)).toBe(120_000);
    expect(payoutRetryDelayMs(20)).toBe(60 * 60_000);
    expect(PAYOUT_CLAIM_LEASE_MS).toBe(60_000);
  });

  it('gives up only after the last allowed attempt failed (boundary pair)', () => {
    expect(MAX_PAYOUT_ATTEMPTS).toBe(5);
    expect(payoutOutcome('FAILED', MAX_PAYOUT_ATTEMPTS - 1)).toBe('retry');
    expect(payoutOutcome('FAILED', MAX_PAYOUT_ATTEMPTS)).toBe('failed');
    expect(payoutOutcome('SUCCEEDED', MAX_PAYOUT_ATTEMPTS)).toBe('sent');
    // PENDING at the provider is not an answer: ask the same reference again later (MO4).
    expect(payoutOutcome('PENDING', 1)).toBe('wait');
  });
});

describe('PayoutsService', () => {
  let db: FakeDb;
  let provider: { createPayment: ReturnType<typeof vi.fn>; getPayment: ReturnType<typeof vi.fn> };
  let service: PayoutsService;
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    db = fakeDb();
    db.$queryRaw.mockResolvedValue([CLAIMED]);
    db.payout.findUnique.mockResolvedValue(STORED);
    db.payout.updateMany.mockResolvedValue({ count: 1 });
    provider = { createPayment: vi.fn(async () => payment()), getPayment: vi.fn() };
    service = new PayoutsService(
      db as never,
      new PayoutsRepository(db as never),
      provider as never,
    );
    logger = { error: vi.fn(), warn: vi.fn() };
    Object.assign(service, { logger });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('claims due payouts with FOR UPDATE SKIP LOCKED and a lease, one statement', async () => {
    await service.sendDue({ now: NOW });
    const sql = sqlOf(db.$queryRaw.mock.calls[0]);
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain("status = 'PENDING'");
    expect(sql).toContain('next_attempt_at <= ?');
    expect(db.$queryRaw.mock.calls[0]).toContain(NOW);
    expect(db.$queryRaw.mock.calls[0]).toContainEqual(
      new Date(NOW.getTime() + PAYOUT_CLAIM_LEASE_MS),
    );
  });

  it('sends by the attempt reference and marks it SENT once, audited', async () => {
    await expect(service.sendDue({ now: NOW })).resolves.toBe(1);
    expect(provider.createPayment).toHaveBeenCalledWith({
      reference: REF_1,
      amountCents: '12450',
      purpose: 'payout',
    });
    expect(db.payout.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'PENDING', providerReference: REF_1 },
      data: { status: 'SENT', sentAt: NOW, providerPaymentId: 'pay_9', lastError: null },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'payout.sent' }) }),
    );

    // The webhook for the same payment, after the worker settled it: nothing more happens.
    db.payout.findUnique.mockResolvedValue({ ...STORED, status: 'SENT' });
    db.auditLog.create.mockClear();
    await expect(service.applyResult(SYSTEM_ACTOR, 'p1', payment())).resolves.toBe('ignored');
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('audits nothing when a concurrent settler won the conditional update', async () => {
    db.payout.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.applyResult(SYSTEM_ACTOR, 'p1', payment())).resolves.toBe('ignored');
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('leaves the payout untouched when the provider is down: same reference next time (provider-down)', async () => {
    provider.createPayment.mockRejectedValue(new AppHttpException('payment.provider_unavailable'));
    await expect(service.sendDue({ now: NOW })).resolves.toBe(1);
    // No status, attempt or reference change: uncertain is not "no" (MO4).
    expect(db.payout.updateMany).toHaveBeenCalledTimes(1);
    expect(db.payout.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'PENDING', providerReference: REF_1 },
      data: { lastError: 'provider_unavailable' },
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('waits on a payment still PENDING at the provider', async () => {
    provider.createPayment.mockResolvedValue(payment({ status: 'PENDING', settledAt: null }));
    await service.sendDue({ now: NOW });
    expect(db.payout.updateMany).not.toHaveBeenCalled();
  });

  it('retries a FAILED attempt with a NEW reference and backoff, never paying twice (MO5)', async () => {
    provider.createPayment.mockResolvedValue(payment({ status: 'FAILED' }));
    await service.sendDue({ now: NOW });
    const update = db.payout.updateMany.mock.calls[0]?.[0] as {
      where: unknown;
      data: { providerReference: string; attempts: number; nextAttemptAt: Date };
    };
    expect(update.where).toEqual({ id: 'p1', status: 'PENDING', providerReference: REF_1 });
    expect(update.data).toMatchObject({
      attempts: 2,
      nextAttemptAt: new Date(NOW.getTime() + payoutRetryDelayMs(1)),
      providerPaymentId: null,
      lastError: 'provider_failed',
    });
    expect(update.data.providerReference).toMatch(/^[0-9a-f-]{36}$/);
    expect(update.data.providerReference).not.toBe(REF_1);
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'payout.attempt_failed' }),
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('treats a refused create (4xx) as a failed attempt', async () => {
    provider.createPayment.mockRejectedValue(new AppHttpException('payment.not_confirmed'));
    await service.sendDue({ now: NOW });
    expect(db.payout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ attempts: 2 }) }),
    );
  });

  it('fails for good after the last attempt and reports the incident once', async () => {
    db.payout.findUnique.mockResolvedValue({ ...STORED, attempts: MAX_PAYOUT_ATTEMPTS });
    provider.createPayment.mockResolvedValue(payment({ status: 'FAILED' }));
    await service.sendDue({ now: NOW });
    expect(db.payout.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'PENDING', providerReference: REF_1 },
      data: {
        status: 'FAILED',
        failedAt: NOW,
        providerPaymentId: 'pay_9',
        lastError: 'provider_failed',
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'payout.failed' }) }),
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[0]).toMatchObject({
      incident: 'payout_failed',
      payoutId: 'p1',
    });

    // The same FAILED answer again (webhook): the payout is no longer PENDING, no second incident.
    db.payout.findUnique.mockResolvedValue({ ...STORED, status: 'FAILED' });
    await service.applyResult(SYSTEM_ACTOR, 'p1', payment({ status: 'FAILED' }));
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('never settles a provider payment that is not ours (attacker / old reference)', async () => {
    await expect(
      service.applyResult(SYSTEM_ACTOR, 'p1', payment({ reference: 'someone-else' })),
    ).rejects.toMatchObject({ code: 'payment.not_confirmed' });
    await expect(
      service.applyResult(SYSTEM_ACTOR, 'p1', payment({ amountCents: '12451' })),
    ).rejects.toMatchObject({ code: 'payment.not_confirmed' });
    expect(db.payout.updateMany).not.toHaveBeenCalled();
  });

  it('ignores a payout that does not exist', async () => {
    db.payout.findUnique.mockResolvedValue(null);
    await expect(service.applyResult(SYSTEM_ACTOR, 'p1', payment())).resolves.toBe('ignored');
  });

  it('keeps sending the batch when one payout cannot be settled, and reports it', async () => {
    const second = {
      ...CLAIMED,
      id: 'p2',
      providerReference: '0199a000-0000-7000-8000-000000000002',
    };
    db.$queryRaw.mockResolvedValue([CLAIMED, second]);
    db.payout.findUnique
      .mockResolvedValueOnce(STORED)
      .mockResolvedValueOnce({ ...STORED, id: 'p2', providerReference: second.providerReference });
    // The first answer is not ours (tampered): refused, logged, and the second still goes out.
    provider.createPayment
      .mockResolvedValueOnce(payment({ amountCents: '1' }))
      .mockResolvedValueOnce(payment({ reference: second.providerReference }));
    await expect(service.sendDue({ now: NOW })).resolves.toBe(2);
    expect(db.payout.updateMany).toHaveBeenCalledTimes(1);
    expect(db.payout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'p2' }) }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ payoutId: 'p1' }),
      expect.any(String),
    );
  });

  it('claims one payout by id for the outbox handler', async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(service.sendDue({ now: NOW, payoutId: 'p1' })).resolves.toBe(0);
    expect(db.$queryRaw.mock.calls[0]).toContain('p1');
    expect(provider.createPayment).not.toHaveBeenCalled();
  });

  it('lists payouts for operations in numbered pages, counting only the filtered status', async () => {
    db.payout.findMany.mockResolvedValue([]);
    db.payout.count.mockResolvedValue(12);
    await expect(
      service.listForAdmin({ page: 2, pageSize: 10, status: 'FAILED' }),
    ).resolves.toEqual({ items: [], page: 2, pageSize: 10, total: 12, totalPages: 2 });
    const failedOnly = { AND: [{ status: 'FAILED' }, {}] };
    expect(db.payout.count).toHaveBeenCalledWith({ where: failedOnly });
    expect(db.payout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: failedOnly,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      }),
    );
  });
});
