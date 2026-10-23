import { AppHttpException } from '@acme/nest-core';
import type { ProviderPayment } from '@acme/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTOR, fakeDb, type FakeDb } from '../../../core/__tests__/fake-db';
import { accountRow } from '../../accounts/__tests__/fixtures';
import { PendingPaymentsSweeper } from '../jobs/pending-payments.sweeper';
import { PaymentSettlementService, type PaymentTarget } from '../payment-settlement.service';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const DEPOSIT_ID = '01a15ff8-f683-77d8-b519-b642a28494d1';
const PROVIDER_ACTOR = { type: 'provider', id: null, requestId: 'req-p' } as const;

function payment(overrides: Partial<ProviderPayment> = {}): ProviderPayment {
  return {
    id: 'pay_1',
    reference: DEPOSIT_ID,
    amountCents: '20000',
    purpose: 'deposit',
    status: 'SUCCEEDED',
    approveUrl: 'http://provider.test/pay/pay_1',
    createdAt: NOW.toISOString(),
    settledAt: NOW.toISOString(),
    ...overrides,
  };
}

function target(overrides: Partial<PaymentTarget> = {}): PaymentTarget {
  return {
    purpose: 'deposit',
    id: DEPOSIT_ID,
    reference: DEPOSIT_ID,
    accountId: 'a1',
    amountCents: 20_000n,
    providerPaymentId: 'pay_1',
    settled: false,
    ...overrides,
  };
}

const actions = (db: FakeDb) =>
  db.auditLog.create.mock.calls.map(
    (call) => (call[0] as { data: { action: string } }).data.action,
  );
const journalKinds = (db: FakeDb) =>
  db.journalEntry.create.mock.calls.map(
    (call) => (call[0] as { data: { kind: string } }).data.kind,
  );

describe('PaymentSettlementService (MO4)', () => {
  let db: FakeDb;
  let provider: { createPayment: ReturnType<typeof vi.fn>; getPayment: ReturnType<typeof vi.fn> };
  let service: PaymentSettlementService;
  let payouts: { applyResult: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db = fakeDb();
    provider = { createPayment: vi.fn(), getPayment: vi.fn(async () => payment()) };
    payouts = { applyResult: vi.fn(async () => 'sent') };
    service = new PaymentSettlementService(db as never, provider as never, payouts as never);
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    db.journalEntry.create.mockResolvedValue({ id: 'e1' });
    db.payout.create.mockResolvedValue({ id: 'p1' });
  });
  afterEach(() => vi.useRealTimers());

  it('finds our row by reference across deposits, repayments and payouts', async () => {
    const row = {
      id: DEPOSIT_ID,
      accountId: 'a1',
      amountCents: 5n,
      providerPaymentId: null,
      status: 'PENDING',
    };
    db.collateralDeposit.findUnique.mockResolvedValueOnce(row).mockResolvedValue(null);
    db.repayment.findUnique
      .mockResolvedValueOnce({ ...row, status: 'CONFIRMED' })
      .mockResolvedValue(null);
    db.payout.findUnique
      .mockResolvedValueOnce({ ...row, status: 'PENDING' })
      .mockResolvedValue(null);
    await expect(service.findByReference(DEPOSIT_ID)).resolves.toMatchObject({
      purpose: 'deposit',
      settled: false,
    });
    await expect(service.findByReference(DEPOSIT_ID)).resolves.toMatchObject({
      purpose: 'repayment',
      settled: true,
    });
    await expect(service.findByReference(DEPOSIT_ID)).resolves.toMatchObject({
      purpose: 'payout',
      settled: false,
    });
    // A payout is known to the provider by its CURRENT attempt's reference (MO5).
    expect(db.payout.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerReference: DEPOSIT_ID } }),
    );
    await expect(service.findByReference(DEPOSIT_ID)).resolves.toBeNull();
    await expect(service.findByReference('not-a-uuid')).resolves.toBeNull();
  });

  it('keeps an EXPIRED payment open for a late approval; CONFIRMED and FAILED are settled', async () => {
    const row = { id: DEPOSIT_ID, accountId: 'a1', amountCents: 5n, providerPaymentId: 'pay_1' };
    db.collateralDeposit.findUnique.mockResolvedValueOnce({ ...row, status: 'EXPIRED' });
    await expect(service.findByReference(DEPOSIT_ID)).resolves.toMatchObject({
      purpose: 'deposit',
      reference: DEPOSIT_ID,
      settled: false,
    });
    for (const status of ['CONFIRMED', 'FAILED']) {
      db.collateralDeposit.findUnique.mockResolvedValueOnce({ ...row, status });
      await expect(service.findByReference(DEPOSIT_ID)).resolves.toMatchObject({ settled: true });
    }
  });

  it('webhook: unknown reference is 404, a settled row is a no-op, otherwise our stored payment is re-read', async () => {
    await expect(
      service.handleWebhook(PROVIDER_ACTOR, { paymentId: 'x', reference: 'nope' }),
    ).rejects.toMatchObject({
      code: 'common.not_found',
    });
    const spy = vi.spyOn(service, 'findByReference');
    spy.mockResolvedValueOnce(target({ settled: true }));
    await service.handleWebhook(PROVIDER_ACTOR, { paymentId: 'pay_1', reference: DEPOSIT_ID });
    expect(provider.getPayment).not.toHaveBeenCalled();

    spy.mockResolvedValueOnce(target({ providerPaymentId: 'pay_ours' }));
    provider.getPayment.mockResolvedValueOnce(payment({ status: 'PENDING' }));
    await expect(
      service.handleWebhook(PROVIDER_ACTOR, { paymentId: 'pay_claimed', reference: DEPOSIT_ID }),
    ).rejects.toMatchObject({ code: 'payment.not_confirmed' });
    expect(provider.getPayment).toHaveBeenCalledWith('pay_ours');

    spy.mockResolvedValueOnce(target({ providerPaymentId: null }));
    provider.getPayment.mockRejectedValueOnce(new AppHttpException('payment.provider_unavailable'));
    await expect(
      service.handleWebhook(PROVIDER_ACTOR, { paymentId: 'pay_claimed', reference: DEPOSIT_ID }),
    ).rejects.toMatchObject({ code: 'payment.provider_unavailable' });
    expect(provider.getPayment).toHaveBeenLastCalledWith('pay_claimed');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('confirms a deposit: collateral and limit from the STORED ratio, activation and card, ledger (MO5)', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(
      accountRow({
        status: 'PENDING_COLLATERAL',
        collateralCents: 0n,
        creditLimitCents: 0n,
        heldCents: 0n,
        postedDebtCents: 0n,
      }),
    );
    db.collateralDeposit.findUniqueOrThrow.mockResolvedValue({
      status: 'PENDING',
      amountCents: 20_000n,
      limitRatioBps: 5_005,
    });
    await service.settle(PROVIDER_ACTOR, target(), payment());
    expect(db.collateralDeposit.update).toHaveBeenCalledWith({
      where: { id: DEPOSIT_ID },
      data: { status: 'CONFIRMED', confirmedAt: NOW },
      select: { id: true },
    });
    const update = db.account.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data).toMatchObject({
      collateralCents: { increment: 20_000n },
      creditLimitCents: { increment: 10_010n },
      status: 'ACTIVE',
      activatedAt: NOW,
      cardExpiresOn: new Date('2030-10-01T00:00:00.000Z'),
    });
    expect(update.data.cardToken).toMatch(/^card_/);
    expect(journalKinds(db)).toEqual(['collateral_deposit']);
    expect(actions(db)).toEqual(['deposit.confirmed', 'account.activated']);
  });

  it('raises the limit of an active account without re-issuing the card (R-55)', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ status: 'ACTIVE' }));
    db.collateralDeposit.findUniqueOrThrow.mockResolvedValue({
      status: 'PENDING',
      amountCents: 20_000n,
      limitRatioBps: 10_000,
    });
    await service.settle(PROVIDER_ACTOR, target(), payment());
    const update = db.account.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data).toEqual({
      collateralCents: { increment: 20_000n },
      creditLimitCents: { increment: 20_000n },
    });
    expect(actions(db)).toEqual(['deposit.confirmed']);
  });

  it('refunds a deposit that lands after the account closed', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ status: 'CLOSED' }));
    db.collateralDeposit.findUniqueOrThrow.mockResolvedValue({
      status: 'PENDING',
      amountCents: 20_000n,
      limitRatioBps: 10_000,
    });
    await service.settle(PROVIDER_ACTOR, target(), payment());
    expect(db.account.update).not.toHaveBeenCalled();
    expect(journalKinds(db)).toEqual(['collateral_deposit', 'collateral_released']);
    expect(db.payout.create).toHaveBeenCalledWith({
      data: { accountId: 'a1', amountCents: 20_000n, reason: 'deposit_refund' },
      select: { id: true },
    });
  });

  it('marks a failed deposit FAILED and credits nothing; a settled one is left alone', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow());
    db.collateralDeposit.findUniqueOrThrow.mockResolvedValueOnce({
      status: 'PENDING',
      amountCents: 20_000n,
      limitRatioBps: 10_000,
    });
    await service.settle(PROVIDER_ACTOR, target(), payment({ status: 'FAILED' }));
    expect(db.collateralDeposit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
    expect(db.account.update).not.toHaveBeenCalled();
    expect(actions(db)).toEqual(['deposit.failed']);

    db.collateralDeposit.findUniqueOrThrow.mockResolvedValueOnce({
      status: 'CONFIRMED',
      amountCents: 20_000n,
      limitRatioBps: 10_000,
    });
    db.collateralDeposit.update.mockClear();
    await service.settle(PROVIDER_ACTOR, target(), payment());
    expect(db.collateralDeposit.update).not.toHaveBeenCalled();
  });

  it('never settles a payment that is not ours', async () => {
    await expect(
      service.settle(ACTOR, target(), payment({ amountCents: '20001' })),
    ).rejects.toMatchObject({
      code: 'payment.not_confirmed',
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('confirms a repayment against the debt, refunding any excess', async () => {
    const repayment = target({ purpose: 'repayment', amountCents: 5_000n });
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ postedDebtCents: 3_000n }));
    db.repayment.findUniqueOrThrow.mockResolvedValue({ status: 'PENDING', amountCents: 5_000n });
    await service.settle(
      PROVIDER_ACTOR,
      repayment,
      payment({ purpose: 'repayment', amountCents: '5000' }),
    );
    expect(db.repayment.update).toHaveBeenCalledWith({
      where: { id: DEPOSIT_ID },
      data: { status: 'CONFIRMED', confirmedAt: NOW, appliedCents: 3_000n },
      select: { id: true },
    });
    expect(db.account.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { postedDebtCents: { decrement: 3_000n } } }),
    );
    expect(journalKinds(db)).toEqual(['repayment']);
    expect(db.payout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { accountId: 'a1', amountCents: 2_000n, reason: 'repayment_refund' },
      }),
    );
  });

  it('applies a repayment fully without a refund, and refunds it all when no debt is left', async () => {
    const repayment = target({ purpose: 'repayment', amountCents: 3_000n });
    const confirmed = payment({ purpose: 'repayment', amountCents: '3000' });
    db.account.findUniqueOrThrow.mockResolvedValueOnce(accountRow({ postedDebtCents: 3_000n }));
    db.repayment.findUniqueOrThrow.mockResolvedValue({ status: 'PENDING', amountCents: 3_000n });
    await service.settle(PROVIDER_ACTOR, repayment, confirmed);
    expect(db.payout.create).not.toHaveBeenCalled();

    db.account.findUniqueOrThrow.mockResolvedValueOnce(
      accountRow({ status: 'CLOSED', postedDebtCents: 0n }),
    );
    db.journalEntry.create.mockClear();
    await service.settle(PROVIDER_ACTOR, repayment, confirmed);
    expect(db.journalEntry.create).not.toHaveBeenCalled();
    expect(db.payout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 3_000n, reason: 'repayment_refund' }),
      }),
    );
  });

  it('marks a failed repayment FAILED; a settled one is left alone', async () => {
    const repayment = target({ purpose: 'repayment', amountCents: 3_000n });
    const failed = payment({ purpose: 'repayment', amountCents: '3000', status: 'FAILED' });
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow());
    db.repayment.findUniqueOrThrow.mockResolvedValueOnce({
      status: 'PENDING',
      amountCents: 3_000n,
    });
    await service.settle(PROVIDER_ACTOR, repayment, failed);
    expect(db.repayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
    expect(actions(db)).toEqual(['repayment.failed']);
    db.repayment.findUniqueOrThrow.mockResolvedValueOnce({ status: 'FAILED', amountCents: 3_000n });
    db.repayment.update.mockClear();
    await service.settle(PROVIDER_ACTOR, repayment, failed);
    expect(db.repayment.update).not.toHaveBeenCalled();
  });

  it('settles a payout webhook through the ONE payout path', async () => {
    const answer = payment({ purpose: 'payout' });
    await service.settle(ACTOR, target({ purpose: 'payout', id: 'p1' }), answer);
    expect(payouts.applyResult).toHaveBeenCalledWith(ACTOR, 'p1', answer);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('settles a late approval of an EXPIRED repayment through the same path', async () => {
    const repayment = target({ purpose: 'repayment', amountCents: 3_000n });
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ postedDebtCents: 3_000n }));
    db.repayment.findUniqueOrThrow.mockResolvedValue({ status: 'EXPIRED', amountCents: 3_000n });
    await service.settle(
      PROVIDER_ACTOR,
      repayment,
      payment({ purpose: 'repayment', amountCents: '3000' }),
    );
    expect(db.repayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
    expect(journalKinds(db)).toEqual(['repayment']);
  });

  it('refunds a late EXPIRED deposit that would take the collateral over the cap (one cent over)', async () => {
    // 9,800.00 held + 200.01 arriving late = one cent over USD 10,000.00.
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ collateralCents: 980_000n }));
    db.collateralDeposit.findUniqueOrThrow.mockResolvedValue({
      status: 'EXPIRED',
      amountCents: 20_001n,
      limitRatioBps: 10_000,
    });
    await service.settle(
      PROVIDER_ACTOR,
      target({ amountCents: 20_001n }),
      payment({ amountCents: '20001' }),
    );
    expect(db.account.update).not.toHaveBeenCalled();
    expect(journalKinds(db)).toEqual(['collateral_deposit', 'collateral_released']);
    expect(db.payout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 20_001n, reason: 'deposit_refund' }),
      }),
    );
  });

  it('credits a late EXPIRED deposit that lands exactly on the cap', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ collateralCents: 980_000n }));
    db.collateralDeposit.findUniqueOrThrow.mockResolvedValue({
      status: 'EXPIRED',
      amountCents: 20_000n,
      limitRatioBps: 10_000,
    });
    await service.settle(PROVIDER_ACTOR, target(), payment());
    expect(db.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ collateralCents: { increment: 20_000n } }),
      }),
    );
    expect(db.payout.create).not.toHaveBeenCalled();
  });

  it('expires a PENDING payment past its expiry once, audited; a settled one is left alone', async () => {
    db.repayment.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const repayment = target({ purpose: 'repayment' });
    await expect(service.expire(SYSTEM, repayment, NOW)).resolves.toBe(true);
    expect(db.repayment.updateMany).toHaveBeenCalledWith({
      where: { id: DEPOSIT_ID, status: 'PENDING', expiresAt: { lte: NOW } },
      data: { status: 'EXPIRED' },
    });
    expect(actions(db)).toEqual(['repayment.expired']);
    await expect(service.expire(SYSTEM, repayment, NOW)).resolves.toBe(false);
    expect(actions(db)).toEqual(['repayment.expired']);

    db.collateralDeposit.updateMany.mockResolvedValueOnce({ count: 1 });
    await service.expire(SYSTEM, target(), NOW);
    expect(actions(db)).toEqual(['repayment.expired', 'deposit.expired']);
  });
});

const SYSTEM = { type: 'system', id: null, requestId: null } as const;

describe('PendingPaymentsSweeper (MO4)', () => {
  it('re-asks the provider about stale pending payments and settles them through the same path', async () => {
    const db = fakeDb();
    const settle = vi.fn(async () => undefined);
    const provider = {
      createPayment: vi.fn(),
      getPayment: vi.fn(async (id: string) =>
        payment({ id, status: id === 'pay_pending' ? 'PENDING' : 'SUCCEEDED' }),
      ),
    };
    const row = (id: string, providerPaymentId: string | null) => ({
      id,
      accountId: 'a1',
      amountCents: 20_000n,
      providerPaymentId,
      expiresAt: new Date(NOW.getTime() + 1),
    });
    db.collateralDeposit.findMany.mockResolvedValue([
      row('d1', 'pay_ok'),
      row('d2', 'pay_pending'),
      row('d3', null),
    ]);
    db.repayment.findMany.mockResolvedValue([row('r1', 'pay_down')]);
    provider.getPayment.mockImplementationOnce(async (id: string) => payment({ id }));
    provider.getPayment.mockImplementationOnce(async (id: string) =>
      payment({ id, status: 'PENDING' }),
    );
    provider.getPayment.mockImplementationOnce(async () => {
      throw new AppHttpException('payment.provider_unavailable');
    });
    const sweeper = new PendingPaymentsSweeper(
      db as never,
      { settle, expire: vi.fn() } as never,
      provider as never,
    );
    await expect(sweeper.sweepOnce(NOW)).resolves.toBe(1);
    expect(db.collateralDeposit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PENDING',
          createdAt: { lt: new Date(NOW.getTime() - 60_000) },
          providerPaymentId: { not: null },
        },
      }),
    );
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(
      { type: 'system', id: null, requestId: null },
      expect.objectContaining({ purpose: 'deposit', id: 'd1', reference: 'd1' }),
      expect.objectContaining({ id: 'pay_ok' }),
    );
  });

  describe('expiry: only what the provider confirms was not paid (MO4)', () => {
    const EXPIRED_AT = NOW;
    function sweeperWith(getPayment: () => Promise<unknown>) {
      const db = fakeDb();
      db.collateralDeposit.findMany.mockResolvedValue([]);
      db.repayment.findMany.mockResolvedValue([
        {
          id: 'r1',
          accountId: 'a1',
          amountCents: 3_000n,
          providerPaymentId: 'pay_r1',
          expiresAt: EXPIRED_AT,
        },
      ]);
      const settlement = { settle: vi.fn(), expire: vi.fn(async () => true) };
      const provider = { createPayment: vi.fn(), getPayment: vi.fn(getPayment) };
      const sweeper = new PendingPaymentsSweeper(
        db as never,
        settlement as never,
        provider as never,
      );
      return { sweeper, settlement };
    }

    it('expires a repayment the provider still has PENDING once its expiry passed', async () => {
      const { sweeper, settlement } = sweeperWith(async () =>
        payment({ id: 'pay_r1', status: 'PENDING', purpose: 'repayment' }),
      );
      await expect(sweeper.sweepOnce(EXPIRED_AT)).resolves.toBe(1);
      expect(settlement.expire).toHaveBeenCalledWith(
        { type: 'system', id: null, requestId: null },
        expect.objectContaining({ purpose: 'repayment', id: 'r1' }),
        EXPIRED_AT,
      );
      expect(settlement.settle).not.toHaveBeenCalled();
    });

    it('does not expire one millisecond before the expiry', async () => {
      const { sweeper, settlement } = sweeperWith(async () =>
        payment({ id: 'pay_r1', status: 'PENDING', purpose: 'repayment' }),
      );
      await sweeper.sweepOnce(new Date(EXPIRED_AT.getTime() - 1));
      expect(settlement.expire).not.toHaveBeenCalled();
    });

    it('expires one the provider does not know (4xx), never one it could not answer (5xx)', async () => {
      const unknown = sweeperWith(async () => {
        throw new AppHttpException('payment.not_confirmed', { status: 404 });
      });
      await unknown.sweeper.sweepOnce(EXPIRED_AT);
      expect(unknown.settlement.expire).toHaveBeenCalledTimes(1);

      const down = sweeperWith(async () => {
        throw new AppHttpException('payment.provider_unavailable');
      });
      await expect(down.sweeper.sweepOnce(EXPIRED_AT)).resolves.toBe(0);
      expect(down.settlement.expire).not.toHaveBeenCalled();
      expect(down.settlement.settle).not.toHaveBeenCalled();
    });

    it('settles a late approval found by the sweep instead of expiring it', async () => {
      const { sweeper, settlement } = sweeperWith(async () =>
        payment({ id: 'pay_r1', purpose: 'repayment', amountCents: '3000' }),
      );
      await sweeper.sweepOnce(EXPIRED_AT);
      expect(settlement.settle).toHaveBeenCalledTimes(1);
      expect(settlement.expire).not.toHaveBeenCalled();
    });
  });
});
