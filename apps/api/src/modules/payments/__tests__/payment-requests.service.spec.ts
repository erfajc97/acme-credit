import { AppHttpException } from '@acme/nest-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTOR, fakeDb, type FakeDb } from '../../../core/__tests__/fake-db';
import { IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { requestHash } from '../../../core/idempotency/request-hash';
import { AccountsService } from '../../accounts/accounts.service';
import { accountRow } from '../../accounts/__tests__/fixtures';
import { PaymentRequestsService } from '../payment-requests.service';

const OWNER = { ...ACTOR, id: ACTOR.id };
const REQUEST = {
  key: '11111111-1111-4111-8111-111111111111',
  method: 'POST',
  path: '/v1/accounts/a1/deposits',
};
const CREATED_AT = new Date('2026-10-21T12:00:00.000Z');
/** The request instant (fake clock) and the expiry the 30-minute policy gives it (MO5). */
const NOW = new Date('2026-10-22T12:00:00.000Z');
const EXPIRES_AT = new Date('2026-10-22T12:30:00.000Z');
const ENV = { PENDING_PAYMENT_TTL_MINUTES: 30 };
const PAYMENT = {
  id: 'pay_1',
  reference: 'd1',
  amountCents: '20000',
  purpose: 'deposit' as const,
  status: 'PENDING' as const,
  approveUrl: 'http://provider.test/pay/pay_1',
  createdAt: CREATED_AT.toISOString(),
  settledAt: null,
};
const paymentRow = {
  id: 'd1',
  accountId: 'a1',
  amountCents: 20_000n,
  status: 'PENDING',
  limitRatioBps: 10_000,
  providerPaymentId: 'pay_1',
  approveUrl: PAYMENT.approveUrl,
  createdAt: CREATED_AT,
  confirmedAt: null,
  expiresAt: EXPIRES_AT,
};

describe('PaymentRequestsService', () => {
  let db: FakeDb;
  let provider: { createPayment: ReturnType<typeof vi.fn>; getPayment: ReturnType<typeof vi.fn> };
  let service: PaymentRequestsService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    db = fakeDb();
    provider = { createPayment: vi.fn(async () => PAYMENT), getPayment: vi.fn() };
    const idempotency = new IdempotencyService(db as never);
    const accounts = new AccountsService(db as never, idempotency, {} as never);
    service = new PaymentRequestsService(
      db as never,
      idempotency,
      accounts,
      provider as never,
      ENV as never,
    );
    db.idempotencyKey.create.mockResolvedValue({ id: 'k1' });
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ status: 'PENDING_COLLATERAL' }));
    db.collateralDeposit.create.mockResolvedValue({ id: 'd1' });
    db.collateralDeposit.findUniqueOrThrow.mockResolvedValue({ amountCents: 20_000n });
    db.collateralDeposit.update.mockResolvedValue(paymentRow);
    db.collateralDeposit.aggregate.mockResolvedValue({ _sum: { amountCents: null } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates the deposit under the lock with the policy ratio, then the provider payment, then stores the response', async () => {
    const deposit = await service.requestDeposit({
      actor: OWNER,
      request: REQUEST,
      accountId: 'a1',
      amountCents: '20000',
    });
    expect(deposit).toMatchObject({
      id: 'd1',
      status: 'PENDING',
      checkout: { paymentId: 'pay_1' },
    });
    expect(db.collateralDeposit.create).toHaveBeenCalledWith({
      data: { accountId: 'a1', amountCents: 20_000n, limitRatioBps: 10_000, expiresAt: EXPIRES_AT },
      select: { id: true },
    });
    expect(db.idempotencyKey.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { resourceId: 'd1' } }),
    );
    expect(provider.createPayment).toHaveBeenCalledWith({
      reference: 'd1',
      amountCents: '20000',
      purpose: 'deposit',
    });
    expect(db.idempotencyKey.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', responseStatus: 201 }),
      }),
    );
  });

  it('checks the per-account collateral cap under the lock, counting live pending deposits', async () => {
    // 2,000.00 confirmed + 7,000.00 pending: 1,000.00 more fits exactly, 1,000.01 does not.
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ collateralCents: 200_000n }));
    db.collateralDeposit.aggregate.mockResolvedValue({ _sum: { amountCents: 700_000n } });
    db.collateralDeposit.findUniqueOrThrow.mockResolvedValue({ amountCents: 100_000n });
    await expect(
      service.requestDeposit({
        actor: OWNER,
        request: REQUEST,
        accountId: 'a1',
        amountCents: '100000',
      }),
    ).resolves.toMatchObject({ id: 'd1' });
    expect(db.collateralDeposit.aggregate).toHaveBeenCalledWith({
      where: { accountId: 'a1', status: 'PENDING', expiresAt: { gt: NOW } },
      _sum: { amountCents: true },
    });
    // The lock is taken before the sum is read (ADR-0003).
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.collateralDeposit.aggregate.mock.invocationCallOrder[0] ?? 0,
    );

    db.idempotencyKey.create.mockResolvedValue({ id: 'k2' });
    db.collateralDeposit.create.mockClear();
    provider.createPayment.mockClear();
    await expect(
      service.requestDeposit({
        actor: OWNER,
        request: REQUEST,
        accountId: 'a1',
        amountCents: '100001',
      }),
    ).rejects.toMatchObject({
      code: 'payment.deposit_cap_exceeded',
      details: { maxCents: '1000000', currentCents: '900000' },
    });
    expect(db.collateralDeposit.create).not.toHaveBeenCalled();
    expect(provider.createPayment).not.toHaveBeenCalled();
  });

  it('stores an out-of-range deposit as the answer and never calls the provider', async () => {
    await expect(
      service.requestDeposit({
        actor: OWNER,
        request: REQUEST,
        accountId: 'a1',
        amountCents: '19999',
      }),
    ).rejects.toMatchObject({ code: 'deposit.amount_out_of_range' });
    expect(provider.createPayment).not.toHaveBeenCalled();
    expect(db.collateralDeposit.create).not.toHaveBeenCalled();
  });

  it('parks the key RETRYABLE when the provider is down, and resumes the same row on retry', async () => {
    provider.createPayment.mockRejectedValueOnce(
      new AppHttpException('payment.provider_unavailable'),
    );
    db.idempotencyKey.findUnique.mockResolvedValueOnce({ resourceId: 'd1' });
    await expect(
      service.requestDeposit({
        actor: OWNER,
        request: REQUEST,
        accountId: 'a1',
        amountCents: '20000',
      }),
    ).rejects.toMatchObject({ code: 'payment.provider_unavailable' });
    expect(db.idempotencyKey.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'RETRYABLE' } }),
    );

    db.idempotencyKey.create.mockRejectedValue({
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });
    // The stored hash is the one the first attempt computed.
    db.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k1',
      requestHash: requestHash({ ...REQUEST, body: { amountCents: '20000' } }),
      status: 'RETRYABLE',
      resourceId: 'd1',
      responseStatus: null,
      responseBody: null,
      attempt: 1,
      lockedUntil: NOW,
    });
    db.idempotencyKey.updateMany.mockResolvedValue({ count: 1 });
    db.collateralDeposit.create.mockClear();
    await expect(
      service.requestDeposit({
        actor: OWNER,
        request: REQUEST,
        accountId: 'a1',
        amountCents: '20000',
      }),
    ).resolves.toMatchObject({ id: 'd1' });
    expect(db.collateralDeposit.create).not.toHaveBeenCalled();
  });

  it('replays a completed key without touching anything', async () => {
    db.idempotencyKey.create.mockRejectedValue({
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });
    db.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k1',
      requestHash: requestHash({ ...REQUEST, body: { amountCents: '20000' } }),
      status: 'COMPLETED',
      resourceId: 'd1',
      responseStatus: 201,
      responseBody: { id: 'd1' },
    });
    await expect(
      service.requestDeposit({
        actor: OWNER,
        request: REQUEST,
        accountId: 'a1',
        amountCents: '20000',
      }),
    ).resolves.toEqual({ id: 'd1' });
    expect(provider.createPayment).not.toHaveBeenCalled();
  });

  it('creates a repayment capped by the debt minus what is already in flight', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ postedDebtCents: 5_000n }));
    db.repayment.aggregate.mockResolvedValue({ _sum: { amountCents: 2_000n } });
    db.repayment.create.mockResolvedValue({ id: 'r1' });
    db.repayment.findUniqueOrThrow.mockResolvedValue({ amountCents: 3_000n });
    db.repayment.update.mockResolvedValue({ ...paymentRow, id: 'r1', amountCents: 3_000n });
    provider.createPayment.mockResolvedValue({ ...PAYMENT, reference: 'r1', purpose: 'repayment' });
    await expect(
      service.requestRepayment({
        actor: OWNER,
        request: REQUEST,
        accountId: 'a1',
        amountCents: '3000',
      }),
    ).resolves.toMatchObject({ id: 'r1', amountCents: '3000' });
    // A repayment past its expiry no longer blocks a new one (it may still settle late).
    expect(db.repayment.aggregate).toHaveBeenCalledWith({
      where: { accountId: 'a1', status: 'PENDING', expiresAt: { gt: NOW } },
      _sum: { amountCents: true },
    });
    expect(db.repayment.create).toHaveBeenCalledWith({
      data: { accountId: 'a1', amountCents: 3_000n, expiresAt: EXPIRES_AT },
      select: { id: true },
    });
    expect(provider.createPayment).toHaveBeenCalledWith({
      reference: 'r1',
      amountCents: '3000',
      purpose: 'repayment',
    });

    db.repayment.aggregate.mockResolvedValue({ _sum: { amountCents: null } });
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ postedDebtCents: 0n }));
    db.idempotencyKey.create.mockResolvedValue({ id: 'k2' });
    await expect(
      service.requestRepayment({
        actor: OWNER,
        request: REQUEST,
        accountId: 'a1',
        amountCents: '1',
      }),
    ).rejects.toMatchObject({ code: 'repayment.no_debt' });
  });

  it('lists only payments with a checkout, after the ownership check', async () => {
    db.account.findFirst.mockResolvedValue({ id: 'a1' });
    db.collateralDeposit.findMany.mockResolvedValue([paymentRow]);
    db.repayment.findMany.mockResolvedValue([]);
    db.collateralDeposit.count.mockResolvedValue(1);
    db.repayment.count.mockResolvedValue(0);
    await expect(
      service.listDeposits('u1', 'a1', { page: 1, pageSize: 10 }),
    ).resolves.toMatchObject({ items: [{ id: 'd1' }], total: 1, totalPages: 1 });
    const checkedOut = { accountId: 'a1', providerPaymentId: { not: null } };
    expect(db.collateralDeposit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: checkedOut, skip: 0, take: 10 }),
    );
    // The total counts the same rows the page shows: payments that reached a checkout.
    expect(db.collateralDeposit.count).toHaveBeenCalledWith({ where: checkedOut });
    await expect(service.listRepayments('u1', 'a1', { page: 2, pageSize: 5 })).resolves.toEqual({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      totalPages: 1,
    });
    expect(db.repayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: checkedOut, skip: 5, take: 5 }),
    );
    expect(db.repayment.count).toHaveBeenCalledWith({ where: checkedOut });

    db.account.findFirst.mockResolvedValue(null);
    await expect(service.listDeposits('u2', 'a1', { page: 1, pageSize: 10 })).rejects.toMatchObject(
      {
        code: 'common.not_found',
      },
    );
    await expect(
      service.listRepayments('u2', 'a1', { page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({
      code: 'common.not_found',
    });
  });
});
