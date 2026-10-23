import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { ACTOR, fakeDb, sqlOf, type FakeDb } from '../../../core/__tests__/fake-db';
import { IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { AccountLifecycleService } from '../account-lifecycle.service';
import { AccountsService } from '../accounts.service';
import { ActivityRepository } from '../activity.repository';
import { lockAndRead } from '../helpers/lock-and-read';
import { accountRow } from './fixtures';

const REQUEST = {
  key: '11111111-1111-4111-8111-111111111111',
  method: 'POST',
  path: '/v1/accounts',
};
const OWNER = { ...ACTOR, id: ACTOR.id };
const ADMIN = {
  type: 'admin' as const,
  id: '00000000-0000-4000-8000-0000000000ad',
  requestId: 'r2',
};
const FROZEN_AT = new Date('2026-10-22T08:30:00.000Z');

/** The activity reads twice: the summed count (`count(*)`) and the page rows. */
function activityReads(db: FakeDb, rows: unknown[], total = rows.length): void {
  db.$queryRaw.mockImplementation(async (strings: string[]) =>
    strings.join('?').includes('count(*)') ? [{ total: BigInt(total) }] : rows,
  );
}

function activityCalls(db: FakeDb, kind: 'page' | 'count'): unknown[][] {
  return db.$queryRaw.mock.calls.filter(
    (call) => sqlOf(call).includes('count(*)') === (kind === 'count'),
  );
}

describe('AccountsService', () => {
  let db: FakeDb;
  let service: AccountsService;

  beforeEach(() => {
    db = fakeDb();
    db.idempotencyKey.create.mockResolvedValue({ id: 'k1' });
    activityReads(db, []);
    service = new AccountsService(
      db as never,
      new IdempotencyService(db as never),
      new ActivityRepository(db as never),
    );
  });

  it('opens an account under a per-customer advisory lock, audited', async () => {
    db.account.findFirst.mockResolvedValue(null);
    db.account.create.mockResolvedValue(
      accountRow({ status: 'PENDING_COLLATERAL', cardToken: null }),
    );
    const account = await service.open(OWNER, REQUEST);
    expect(account.status).toBe('PENDING_COLLATERAL');
    expect(sqlOf(db.$executeRaw.mock.calls[1])).toContain('pg_advisory_xact_lock');
    expect(db.$executeRaw.mock.calls[1]?.[1]).toBe(`account-open:${OWNER.id}`);
    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { customerId: OWNER.id, status: { not: 'CLOSED' } },
      select: { id: true },
    });
    expect(db.account.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { customerId: OWNER.id } }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'account.opened' }) }),
    );
  });

  it('refuses a second open account', async () => {
    db.account.findFirst.mockResolvedValue({ id: 'a0' });
    await expect(service.open(OWNER, REQUEST)).rejects.toMatchObject({
      code: 'account.already_open',
      details: { accountId: 'a0' },
    });
    expect(db.account.create).not.toHaveBeenCalled();
  });

  it("returns the customer's latest account, or 404", async () => {
    db.account.findFirst.mockResolvedValueOnce(accountRow()).mockResolvedValueOnce(null);
    await expect(service.getMine('u1')).resolves.toMatchObject({ id: 'a1' });
    expect(db.account.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 'u1' },
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      }),
    );
    await expect(service.getMine('u1')).rejects.toMatchObject({ code: 'common.not_found' });
  });

  it('gates reads by owner: a foreign account is 404', async () => {
    db.account.findFirst.mockResolvedValue(null);
    await expect(service.listActivity('u2', 'a1', { page: 1, pageSize: 10 })).rejects.toMatchObject(
      {
        code: 'common.not_found',
      },
    );
    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { id: 'a1', customerId: 'u2' },
      select: { id: true },
    });
  });

  it('pages the activity newest first with the summed total', async () => {
    db.account.findFirst.mockResolvedValue({ id: 'a1' });
    const at = new Date('2026-10-21T12:00:00.000Z');
    activityReads(
      db,
      [
        {
          id: '01a15ff8-f683-77d8-b519-b642a28494f1',
          type: 'deposit',
          status: 'CONFIRMED',
          amount_cents: 20_000n,
          description: 'Collateral deposit',
          merchant_name: null,
          items: [],
          created_at: at,
        },
      ],
      11,
    );
    const page = await service.listActivity('u1', 'a1', { page: 2, pageSize: 10 });
    expect(page).toEqual({
      items: [
        {
          id: '01a15ff8-f683-77d8-b519-b642a28494f1',
          type: 'deposit',
          status: 'CONFIRMED',
          amountCents: '20000',
          description: 'Collateral deposit',
          merchantName: null,
          itemCount: 0,
          items: [],
          createdAt: at.toISOString(),
        },
      ],
      page: 2,
      pageSize: 10,
      total: 11,
      totalPages: 2,
    });
  });

  it('counts every source with the same account filter as the page, and sums them', async () => {
    db.account.findFirst.mockResolvedValue({ id: 'a1' });
    await service.listActivity('u1', 'a1', { page: 1, pageSize: 10 });
    const [count] = activityCalls(db, 'count');
    const sql = sqlOf(count);
    expect(sql.match(/count\(\*\)/g)).toHaveLength(4);
    expect(sql.match(/\+/g)).toHaveLength(3);
    for (const table of [
      'collateral_deposits',
      'authorizations',
      'repayments',
      'journal_entries',
    ]) {
      expect(sql).toContain(`FROM ${table}`);
    }
    expect(sql).toContain("kind IN ('collateral_applied', 'collateral_released')");
    expect(sql).toContain('p.amount_cents > 0');
    expect((count ?? []).slice(1)).toEqual(['a1', 'a1', 'a1', 'a1']);
  });

  it('cuts every source to the rows up to the page end, then OFFSETs the merge', async () => {
    db.account.findFirst.mockResolvedValue({ id: 'a1' });
    await service.listActivity('u1', 'a1', { page: 3, pageSize: 5 });
    const [read] = activityCalls(db, 'page');
    const sql = sqlOf(read);
    // Four sources (deposits, purchases, repayments, collateral moves) plus the merged page.
    expect(sql.match(/LIMIT \?/g)).toHaveLength(5);
    expect(sql).toMatch(/LIMIT \? OFFSET \?$/);
    expect(sql.match(/ORDER BY created_at DESC, id DESC/g)).toHaveLength(5);
    const params = (read ?? []).slice(1);
    // Page 3 of 5 ends at row 15: no source needs more; the merge skips 10 and takes 5.
    expect(params.filter((value) => value === 15)).toHaveLength(4);
    expect(params.slice(-2)).toEqual([5, 10]);
  });

  it('gives a store purchase its merchant, item count and priced lines; plain purchases have none', async () => {
    db.account.findFirst.mockResolvedValue({ id: 'a1' });
    const at = new Date('2026-10-21T12:00:00.000Z');
    const purchase = (id: string, items: unknown[]) => ({
      id,
      type: 'purchase',
      status: 'APPROVED',
      amount_cents: 1_000n,
      description: 'Taquería El Sol',
      merchant_name: 'Taquería El Sol',
      items,
      created_at: at,
    });
    const pastor = { sku: 'TAQ-PASTOR', name: 'Tacos al pastor', quantity: 2, unitCents: '350' };
    const agua = { sku: 'AGUA-1', name: 'Agua fresca', quantity: 1, unitCents: '300' };
    activityReads(db, [
      purchase('01a15ff8-f683-77d8-b519-b642a28494f3', [pastor]),
      purchase('01a15ff8-f683-77d8-b519-b642a28494f2', [agua]),
      purchase('01a15ff8-f683-77d8-b519-b642a28494f1', []),
    ]);
    const page = await service.listActivity('u1', 'a1', { page: 1, pageSize: 3 });
    expect(page.items.map((item) => item.description)).toEqual([
      'Taquería El Sol · 2 items',
      'Taquería El Sol · 1 item',
      'Taquería El Sol',
    ]);
    expect(page.items.map((item) => [item.merchantName, item.itemCount])).toEqual([
      ['Taquería El Sol', 2],
      ['Taquería El Sol', 1],
      ['Taquería El Sol', 0],
    ]);
    expect(page.items[0]?.items).toEqual([
      {
        sku: 'TAQ-PASTOR',
        name: 'Tacos al pastor',
        quantity: 2,
        unitPriceCents: '350',
        lineTotalCents: '700',
      },
    ]);
    expect(page.items[2]?.items).toEqual([]);
  });

  it('refuses stored lines that are not order lines instead of showing them', async () => {
    db.account.findFirst.mockResolvedValue({ id: 'a1' });
    activityReads(db, [
      {
        id: '01a15ff8-f683-77d8-b519-b642a28494f3',
        type: 'purchase',
        status: 'APPROVED',
        amount_cents: 1_000n,
        description: 'Shop',
        merchant_name: 'Shop',
        items: [{ sku: 'X' }],
        created_at: new Date('2026-10-21T12:00:00.000Z'),
      },
    ]);
    await expect(service.listActivity('u1', 'a1', { page: 1, pageSize: 3 })).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});

describe('AccountLifecycleService', () => {
  let db: FakeDb;
  let service: AccountLifecycleService;

  beforeEach(() => {
    db = fakeDb();
    db.idempotencyKey.create.mockResolvedValue({ id: 'k1' });
    activityReads(db, []);
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    service = new AccountLifecycleService(new IdempotencyService(db as never));
  });

  it('freezes an active account and unfreezes a frozen one, recording who and why, audited', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_AT);
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ status: 'ACTIVE' }));
    db.account.update.mockResolvedValue(
      accountRow({ status: 'FROZEN', frozenBy: 'CUSTOMER', freezeReason: 'customer_request' }),
    );
    await expect(
      service.freeze(ACTOR, REQUEST, { accountId: 'a1', ownerId: 'u1' }),
    ).resolves.toMatchObject({ status: 'FROZEN', frozenBy: 'CUSTOMER' });
    expect(db.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'FROZEN',
          frozenBy: 'CUSTOMER',
          freezeReason: 'customer_request',
          frozenAt: FROZEN_AT,
        },
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'account.frozen',
          data: { from: 'ACTIVE', to: 'FROZEN', frozenBy: 'CUSTOMER', reason: 'customer_request' },
        }),
      }),
    );

    db.account.findUniqueOrThrow.mockResolvedValue(
      accountRow({ status: 'FROZEN', frozenBy: 'CUSTOMER', freezeReason: 'customer_request' }),
    );
    db.account.update.mockResolvedValue(accountRow({ status: 'ACTIVE' }));
    await service.unfreeze(ACTOR, REQUEST, { accountId: 'a1' });
    expect(db.account.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { status: 'ACTIVE', frozenBy: null, freezeReason: null, frozenAt: null },
      }),
    );
    expect(db.auditLog.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'account.unfrozen' }) }),
    );
    vi.useRealTimers();
  });

  it('freezes as ADMIN with the reason the admin picked (admin_review when none)', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow({ status: 'ACTIVE' }));
    db.account.update.mockResolvedValue(
      accountRow({ status: 'FROZEN', frozenBy: 'ADMIN', freezeReason: 'suspected_fraud' }),
    );
    await service.freeze(ADMIN, REQUEST, { accountId: 'a1' }, 'suspected_fraud');
    expect(db.account.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ frozenBy: 'ADMIN', freezeReason: 'suspected_fraud' }),
      }),
    );
    db.idempotencyKey.create.mockResolvedValue({ id: 'k2' });
    await service.freeze(ADMIN, REQUEST, { accountId: 'a1' });
    expect(db.account.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ frozenBy: 'ADMIN', freezeReason: 'admin_review' }),
      }),
    );
  });

  it("refuses the customer's unfreeze of an admin freeze, writing nothing (attacker case)", async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(
      accountRow({ status: 'FROZEN', frozenBy: 'ADMIN', freezeReason: 'suspected_fraud' }),
    );
    await expect(
      service.unfreeze(ACTOR, REQUEST, { accountId: 'a1', ownerId: 'u1' }),
    ).rejects.toMatchObject({ code: 'account.frozen_by_admin' });
    expect(db.account.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('answers 404 when the account is not the owner’s', async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(
      service.freeze(ACTOR, REQUEST, { accountId: 'a1', ownerId: 'u2' }),
    ).rejects.toMatchObject({ code: 'common.not_found' });
    expect(db.account.update).not.toHaveBeenCalled();
  });

  it('closes with debt: applies collateral, releases the rest, requests the payout', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(
      accountRow({ heldCents: 0n, postedDebtCents: 7_550n }),
    );
    db.account.update.mockResolvedValue(
      accountRow({
        status: 'CLOSED',
        collateralCents: 0n,
        creditLimitCents: 0n,
        heldCents: 0n,
        postedDebtCents: 0n,
      }),
    );
    db.journalEntry.create.mockResolvedValue({ id: 'e1' });
    db.payout.create.mockResolvedValue({ id: 'p1' });
    const result = await service.close(ACTOR, REQUEST, { accountId: 'a1', ownerId: 'u1' });
    expect(result.settlement).toEqual({
      collateralCents: '20000',
      appliedToDebtCents: '7550',
      releasedCents: '12450',
    });
    expect(db.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CLOSED',
          collateralCents: 0n,
          creditLimitCents: 0n,
          postedDebtCents: 0n,
        }),
      }),
    );
    const kinds = db.journalEntry.create.mock.calls.map(
      (call) => (call[0] as { data: { kind: string } }).data.kind,
    );
    expect(kinds).toEqual(['collateral_applied', 'collateral_released']);
    expect(db.payout.create).toHaveBeenCalledWith({
      data: { accountId: 'a1', amountCents: 12_450n, reason: 'collateral_release' },
      select: { id: true },
    });
    expect(db.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'payout.requested' }) }),
    );
  });

  it('closes with nothing to apply or release without ledger entries or payouts', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(
      accountRow({
        status: 'PENDING_COLLATERAL',
        collateralCents: 0n,
        creditLimitCents: 0n,
        heldCents: 0n,
        postedDebtCents: 0n,
      }),
    );
    db.account.update.mockResolvedValue(accountRow({ status: 'CLOSED' }));
    await service.close(ACTOR, REQUEST, { accountId: 'a1' });
    expect(db.journalEntry.create).not.toHaveBeenCalled();
    expect(db.payout.create).not.toHaveBeenCalled();
  });

  it('lockAndRead takes the lock before reading', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue(accountRow());
    const order: string[] = [];
    db.$queryRaw.mockImplementation(async () => {
      order.push('lock');
      return [{ id: 'a1' }];
    });
    db.account.findUniqueOrThrow.mockImplementation(async () => {
      order.push('read');
      return accountRow();
    });
    await lockAndRead(db as never, { accountId: 'a1' });
    expect(order).toEqual(['lock', 'read']);
    expect(vi.isMockFunction(db.account.findUniqueOrThrow)).toBe(true);
  });
});
