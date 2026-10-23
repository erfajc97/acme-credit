import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, sqlOf, type FakeDb } from '../../../core/__tests__/fake-db';
import { IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { AccountsService } from '../../accounts/accounts.service';
import { AuthorizationsService } from '../authorizations.service';
import {
  assertCapturable,
  assertLinesMatchAmount,
  assertReversible,
  declineReasonFor,
  type CardAccount,
} from '../helpers/authorization-rules';

const NOW = new Date('2026-10-21T12:00:00.000Z');
/** HOLD_TTL_HOURS = 168: an approval at NOW expires 7 days later (MO5). */
const HOLD_ENV = { HOLD_TTL_HOURS: 168 };
const EXPIRES_AT = new Date('2026-10-28T12:00:00.000Z');
const LIVE = { expiresAt: EXPIRES_AT, reversalReason: null };
const NETWORK = { type: 'network', id: null, requestId: 'req-n' } as const;
const REQUEST = {
  key: '22222222-2222-4222-8222-222222222222',
  method: 'POST',
  path: '/v1/network/authorizations',
};
const ACTIVE: CardAccount = {
  status: 'ACTIVE',
  cardExpiresOn: new Date('2030-10-01T00:00:00.000Z'),
  creditLimitCents: 20_000n,
  heldCents: 5_000n,
  postedDebtCents: 3_000n,
};

describe('declineReasonFor (R-03)', () => {
  it('approves exactly the available credit and declines one cent more', () => {
    expect(declineReasonFor(ACTIVE, 12_000n, NOW)).toBeNull();
    expect(declineReasonFor(ACTIVE, 12_001n, NOW)).toBe('insufficient_funds');
  });

  it('declines unknown, card-less and expired cards as invalid, then frozen, then not active', () => {
    expect(declineReasonFor(null, 1n, NOW)).toBe('invalid_card');
    expect(declineReasonFor({ ...ACTIVE, cardExpiresOn: null }, 1n, NOW)).toBe('invalid_card');
    expect(
      declineReasonFor({ ...ACTIVE, cardExpiresOn: new Date('2026-09-01T00:00:00.000Z') }, 1n, NOW),
    ).toBe('invalid_card');
    expect(declineReasonFor({ ...ACTIVE, status: 'FROZEN' }, 1n, NOW)).toBe('card_frozen');
    expect(declineReasonFor({ ...ACTIVE, status: 'CLOSED' }, 1n, NOW)).toBe('account_not_active');
    // A frozen card says "frozen" even when the amount would not fit either.
    expect(declineReasonFor({ ...ACTIVE, status: 'FROZEN' }, 99_999n, NOW)).toBe('card_frozen');
  });

  it('captures only a live hold, up to the authorized amount', () => {
    const hold = { status: 'APPROVED' as const, amountCents: 500n, ...LIVE };
    expect(() => assertCapturable(hold, 500n, NOW)).not.toThrow();
    expect(() => assertCapturable(hold, 501n, NOW)).toThrow(
      expect.objectContaining({ code: 'authorization.capture_exceeds_hold' }),
    );
    expect(() => assertCapturable({ ...hold, status: 'CAPTURED' }, 1n, NOW)).toThrow(
      expect.objectContaining({ code: 'authorization.not_capturable' }),
    );
    expect(() => assertReversible({ status: 'APPROVED' })).not.toThrow();
    expect(() => assertReversible({ status: 'REVERSED' })).toThrow(
      expect.objectContaining({ code: 'authorization.not_reversible' }),
    );
  });
});

const LINES = [
  { sku: 'TAQ-PASTOR', name: 'Tacos al pastor', quantity: 2, unitCents: '350' },
  { sku: 'TAQ-AGUA', name: 'Agua fresca', quantity: 1, unitCents: '300' },
];

describe('assertLinesMatchAmount (store purchases)', () => {
  it('passes when the lines total the amount and fails one cent over', () => {
    expect(() => assertLinesMatchAmount(LINES, 1_000n)).not.toThrow();
    expect(() => assertLinesMatchAmount(undefined, 1_000n)).not.toThrow();
    expect(() => assertLinesMatchAmount(LINES, 1_001n)).toThrow(
      expect.objectContaining({
        code: 'common.validation_failed',
        details: { reason: 'items_total_mismatch' },
      }),
    );
  });

  it('fails one cent under too: lines worth more than the amount would undercharge the store', () => {
    expect(() => assertLinesMatchAmount(LINES, 999n)).toThrow(
      expect.objectContaining({
        code: 'common.validation_failed',
        details: { reason: 'items_total_mismatch' },
      }),
    );
  });
});

describe('AuthorizationsService', () => {
  let db: FakeDb;
  let service: AuthorizationsService;
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'z1',
    accountId: 'a1',
    amountCents: 1_000n,
    capturedCents: 0n,
    status: 'APPROVED',
    declineReason: null,
    merchantName: 'Corner Grocery',
    merchantMcc: '5411',
    items: [],
    ...LIVE,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
  const input = {
    cardToken: 'card_x',
    amountCents: '1000',
    merchant: { name: 'Corner Grocery', mcc: '5411' },
  };

  beforeEach(() => {
    db = fakeDb();
    db.idempotencyKey.create.mockResolvedValue({ id: 'k1' });
    const idempotency = new IdempotencyService(db as never);
    service = new AuthorizationsService(
      db as never,
      idempotency,
      new AccountsService(db as never, idempotency, {} as never),
      HOLD_ENV as never,
    );
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('approves under the card lock with a conditional hold, and stores the decision', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    db.account.findUniqueOrThrow.mockResolvedValue(ACTIVE);
    db.$executeRaw.mockResolvedValue(1);
    db.authorization.create.mockResolvedValue(row());
    await expect(service.authorize(NETWORK, REQUEST, input)).resolves.toMatchObject({
      status: 'APPROVED',
      amountCents: '1000',
    });
    expect(sqlOf(db.$queryRaw.mock.calls[0])).toContain('card_token = ? FOR UPDATE');
    const hold = db.$executeRaw.mock.calls[1];
    expect(sqlOf(hold)).toContain('credit_limit_cents - held_cents - posted_debt_cents >= ?');
    expect(hold?.slice(1)).toEqual([1_000n, 'a1', 1_000n]);
    expect(db.authorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          accountId: 'a1',
          amountCents: 1_000n,
          status: 'APPROVED',
          declineReason: null,
          merchantName: 'Corner Grocery',
          merchantMcc: '5411',
          items: [],
          expiresAt: EXPIRES_AT,
        },
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'authorization.approved', actorType: 'network' }),
      }),
    );
  });

  it('stores and returns the order lines of a store purchase', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    db.account.findUniqueOrThrow.mockResolvedValue(ACTIVE);
    db.$executeRaw.mockResolvedValue(1);
    db.authorization.create.mockResolvedValue(row({ items: LINES }));
    await expect(
      service.authorize(NETWORK, REQUEST, { ...input, items: LINES }),
    ).resolves.toMatchObject({ items: LINES });
    expect(db.authorization.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ items: LINES }) }),
    );
  });

  it('rejects lines one cent over or under the amount before writing anything', async () => {
    // One cent over and one cent under: an amount below the lines would undercharge.
    for (const amountCents of ['1001', '999']) {
      await expect(
        service.authorize(NETWORK, REQUEST, { ...input, amountCents, items: LINES }),
      ).rejects.toMatchObject({
        code: 'common.validation_failed',
        details: { reason: 'items_total_mismatch' },
      });
    }
    expect(db.idempotencyKey.create).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.authorization.create).not.toHaveBeenCalled();
  });

  it('declines as insufficient funds when the conditional hold matches no row', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    db.account.findUniqueOrThrow.mockResolvedValue(ACTIVE);
    db.$executeRaw.mockResolvedValue(0);
    db.authorization.create.mockResolvedValue(
      row({ status: 'DECLINED', declineReason: 'insufficient_funds', expiresAt: null }),
    );
    await service.authorize(NETWORK, REQUEST, input);
    // A decline holds nothing, so nothing expires.
    expect(db.authorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DECLINED',
          declineReason: 'insufficient_funds',
          expiresAt: null,
        }),
      }),
    );
  });

  it('declines an unknown card without touching any account', async () => {
    db.$queryRaw.mockResolvedValue([]);
    db.authorization.create.mockResolvedValue(
      row({ accountId: null, status: 'DECLINED', declineReason: 'invalid_card' }),
    );
    await expect(service.authorize(NETWORK, REQUEST, input)).resolves.toMatchObject({
      accountId: null,
      declineReason: 'invalid_card',
    });
    expect(db.account.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('captures: hold released in full, debt = captured amount, ledger entry', async () => {
    db.authorization.findUnique.mockResolvedValue({ accountId: 'a1' });
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    db.account.findUniqueOrThrow.mockResolvedValue({ id: 'a1' });
    db.authorization.findUniqueOrThrow.mockResolvedValue({
      id: 'z1',
      status: 'APPROVED',
      amountCents: 1_000n,
      merchantName: 'Corner Grocery',
      ...LIVE,
    });
    db.authorization.update.mockResolvedValue(row({ status: 'CAPTURED', capturedCents: 800n }));
    db.journalEntry.create.mockResolvedValue({ id: 'e1' });
    await expect(
      service.capture(NETWORK, REQUEST, { authorizationId: 'z1', amountCents: '800' }),
    ).resolves.toMatchObject({ status: 'CAPTURED', capturedCents: '800' });
    expect(db.account.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { heldCents: { decrement: 1_000n }, postedDebtCents: { increment: 800n } },
      select: { id: true },
    });
    expect(db.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'purchase_capture',
          description: 'Purchase at Corner Grocery',
        }),
      }),
    );
  });

  it('refuses to capture a missing or declined authorization', async () => {
    db.authorization.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ accountId: null });
    await expect(
      service.capture(NETWORK, REQUEST, { authorizationId: 'z1', amountCents: '1' }),
    ).rejects.toMatchObject({
      code: 'common.not_found',
    });
    db.idempotencyKey.create.mockResolvedValue({ id: 'k2' });
    await expect(
      service.capture(NETWORK, REQUEST, { authorizationId: 'z1', amountCents: '1' }),
    ).rejects.toMatchObject({
      code: 'authorization.not_capturable',
    });
  });

  it('reverses: releases the hold; a declined one is not reversible', async () => {
    db.authorization.findUnique
      .mockResolvedValueOnce({ accountId: 'a1' })
      .mockResolvedValueOnce({ accountId: null });
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    db.account.findUniqueOrThrow.mockResolvedValue({ id: 'a1' });
    db.authorization.findUniqueOrThrow.mockResolvedValue({
      id: 'z1',
      status: 'APPROVED',
      amountCents: 1_000n,
      merchantName: 'X',
      ...LIVE,
    });
    db.authorization.update.mockResolvedValue(
      row({ status: 'REVERSED', reversalReason: 'network' }),
    );
    await expect(service.reverse(NETWORK, REQUEST, 'z1')).resolves.toMatchObject({
      status: 'REVERSED',
    });
    expect(db.account.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { heldCents: { decrement: 1_000n } },
      select: { id: true },
    });
    expect(db.authorization.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REVERSED', reversalReason: 'network' } }),
    );
    await expect(service.reverse(NETWORK, REQUEST, 'z2')).rejects.toMatchObject({
      code: 'authorization.not_reversible',
    });
  });

  it('lists an owned account, 404 for a foreign one', async () => {
    db.account.findFirst.mockResolvedValueOnce({ id: 'a1' }).mockResolvedValueOnce(null);
    db.authorization.findMany.mockResolvedValue([row()]);
    db.authorization.count.mockResolvedValue(21);
    await expect(
      service.listForCustomer('u1', 'a1', { page: 3, pageSize: 10 }),
    ).resolves.toMatchObject({ items: [{ id: 'z1' }], page: 3, total: 21, totalPages: 3 });
    expect(db.authorization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ accountId: 'a1' }, {}] },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 20,
        take: 10,
      }),
    );
    expect(db.authorization.count).toHaveBeenCalledWith({
      where: { AND: [{ accountId: 'a1' }, {}] },
    });
    await expect(
      service.listForCustomer('u2', 'a1', { page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({
      code: 'common.not_found',
    });
  });
});
