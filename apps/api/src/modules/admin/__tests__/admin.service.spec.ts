import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '../../../core/__tests__/fake-db';
import { accountRow } from '../../accounts/__tests__/fixtures';
import { toAuditLogEntry } from '../admin.mapper';
import { AdminService } from '../admin.service';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const CUSTOMER = { id: 'u1', email: 'ada@acme.test', fullName: 'Ada' };

describe('AdminService', () => {
  let db: FakeDb;
  let authorizations: { listForAccount: ReturnType<typeof vi.fn> };
  let repository: { dashboardTotals: ReturnType<typeof vi.fn> };
  let reconciliation: { balances: ReturnType<typeof vi.fn> };
  let payouts: { listForAccount: ReturnType<typeof vi.fn>; listForAdmin: ReturnType<typeof vi.fn> };
  let service: AdminService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db = fakeDb();
    authorizations = {
      listForAccount: vi.fn(async () => ({
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      })),
    };
    repository = { dashboardTotals: vi.fn() };
    reconciliation = { balances: vi.fn(async () => []) };
    payouts = { listForAccount: vi.fn(async () => []), listForAdmin: vi.fn() };
    service = new AdminService(
      db as never,
      authorizations as never,
      repository as never,
      payouts as never,
      reconciliation as never,
    );
  });
  afterEach(() => vi.useRealTimers());

  it('builds the dashboard from one totals read: every status, balances, last-24h decisions, trial balance', async () => {
    repository.dashboardTotals.mockResolvedValue({
      accounts_by_status: { ACTIVE: 3, FROZEN: 1 },
      collateral_cents: 60_000n,
      credit_limit_cents: 61_000n,
      held_cents: 1_500n,
      posted_debt_cents: 2_500n,
      approved: 9,
      declined: 4,
      trial_balance_cents: 0n,
    });
    const drifted = '01a15ff8-f683-77d8-b519-b642a28494f9';
    reconciliation.balances.mockResolvedValue([
      {
        accountId: 'a1',
        collateralCents: 500n,
        ledgerCollateralCents: -500n,
        postedDebtCents: 0n,
        ledgerReceivableCents: 0n,
      },
      {
        accountId: drifted,
        collateralCents: 500n,
        ledgerCollateralCents: -500n,
        postedDebtCents: 1n,
        ledgerReceivableCents: 0n,
      },
    ]);
    await expect(service.dashboard()).resolves.toEqual({
      accountsByStatus: { PENDING_COLLATERAL: 0, ACTIVE: 3, FROZEN: 1, CLOSED: 0 },
      collateralHeldCents: '60000',
      creditLimitCents: '61000',
      heldCents: '1500',
      receivableCents: '2500',
      authorizationsLast24h: { approved: 9, declined: 4 },
      ledgerTrialBalanceCents: '0',
      reconciliation: { accountsChecked: 2, mismatches: 1, mismatchedAccountIds: [drifted] },
    });
    // The window is the last 24 hours from now, to the millisecond.
    expect(repository.dashboardTotals).toHaveBeenCalledExactlyOnceWith(
      new Date(NOW.getTime() - 86_400_000),
    );
  });

  it('shows an unbalanced ledger as it is (the alarm must not be hidden)', async () => {
    repository.dashboardTotals.mockResolvedValue({
      accounts_by_status: {},
      collateral_cents: 0n,
      credit_limit_cents: 0n,
      held_cents: 0n,
      posted_debt_cents: 0n,
      approved: 0,
      declined: 0,
      trial_balance_cents: -7n,
    });
    await expect(service.dashboard()).resolves.toMatchObject({
      accountsByStatus: { PENDING_COLLATERAL: 0, ACTIVE: 0, FROZEN: 0, CLOSED: 0 },
      collateralHeldCents: '0',
      ledgerTrialBalanceCents: '-7',
    });
  });

  it('filters accounts by status and by email or name', async () => {
    db.account.findMany.mockResolvedValue([{ ...accountRow(), customer: CUSTOMER }]);
    db.account.count.mockResolvedValue(11);
    const page = await service.listAccounts({ page: 2, pageSize: 10, status: 'ACTIVE', q: 'ada' });
    expect(page).toMatchObject({ page: 2, pageSize: 10, total: 11, totalPages: 2 });
    expect(page.items[0]).toMatchObject({ id: 'a1', customer: CUSTOMER, cardLast4: '4242' });
    expect(page.items[0]).not.toHaveProperty('card');
    const where = (db.account.findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } }).where;
    expect(where.AND).toEqual([
      { status: 'ACTIVE' },
      {
        OR: [
          {
            customer: {
              OR: [
                { email: { contains: 'ada', mode: 'insensitive' } },
                { fullName: { contains: 'ada', mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
    ]);
    // The total counts exactly the rows the filter pages through.
    expect(db.account.count).toHaveBeenCalledWith({ where });
    expect(db.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      }),
    );
    await service.listAccounts({ page: 1, pageSize: 10 });
    const unfiltered = (db.account.findMany.mock.calls[1]?.[0] as { where: { AND: unknown[] } })
      .where;
    expect(unfiltered.AND).toEqual([{}, {}]);
  });

  it('shows one account with who froze it and its payouts, or 404', async () => {
    const payout = { id: 'p1', status: 'PENDING', attempts: 2, lastError: 'provider_failed' };
    payouts.listForAccount.mockResolvedValue([payout]);
    db.account.findUnique
      .mockResolvedValueOnce({
        ...accountRow({ status: 'FROZEN', frozenBy: 'ADMIN', freezeReason: 'suspected_fraud' }),
        customer: CUSTOMER,
      })
      .mockResolvedValueOnce(null);
    await expect(service.getAccount('a1')).resolves.toMatchObject({
      id: 'a1',
      frozenBy: 'ADMIN',
      freezeReason: 'suspected_fraud',
      payouts: [payout],
    });
    expect(payouts.listForAccount).toHaveBeenCalledWith('a1');
    await expect(service.getAccount('a2')).rejects.toMatchObject({ code: 'common.not_found' });
  });

  it('lists payouts through the payouts module (numbered page, status filter)', async () => {
    const page = { items: [], page: 1, pageSize: 5, total: 0, totalPages: 1 };
    payouts.listForAdmin.mockResolvedValue(page);
    const query = { page: 1, pageSize: 5, status: 'FAILED' as const };
    await expect(service.listPayouts(query)).resolves.toBe(page);
    expect(payouts.listForAdmin).toHaveBeenCalledWith(query);
  });

  it("lists an account's authorizations and ledger only when the account exists", async () => {
    db.account.findUnique
      .mockResolvedValueOnce({ id: 'a1' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'a1' });
    await service.accountAuthorizations('a1', { page: 1, pageSize: 10 });
    expect(authorizations.listForAccount).toHaveBeenCalledWith('a1', { page: 1, pageSize: 10 });
    await expect(
      service.accountAuthorizations('a2', { page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({
      code: 'common.not_found',
    });

    db.journalEntry.findMany.mockResolvedValue([
      {
        id: 'e1',
        kind: 'repayment',
        accountId: 'a1',
        description: 'Repayment confirmed',
        createdAt: NOW,
        postings: [
          { ledgerAccount: 'cash_clearing', amountCents: 500n },
          { ledgerAccount: 'receivable:a1', amountCents: -500n },
        ],
      },
    ]);
    db.journalEntry.count.mockResolvedValue(1);
    const ledger = await service.ledger({ page: 1, pageSize: 10, accountId: 'a1' });
    const accountOnly = { AND: [{ accountId: 'a1' }, {}] };
    expect(db.journalEntry.count).toHaveBeenCalledWith({ where: accountOnly });
    expect(db.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: accountOnly, skip: 0, take: 10 }),
    );
    expect(ledger.items[0]?.postings).toEqual([
      { ledgerAccount: 'cash_clearing', amountCents: '500' },
      { ledgerAccount: 'receivable:a1', amountCents: '-500' },
    ]);
    await service.ledger({ page: 1, pageSize: 10 });
    expect(db.journalEntry.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { AND: [{}, {}] } }),
    );
  });

  it('a ledger of a missing account is 404 even though its page reads empty', async () => {
    db.account.findUnique.mockResolvedValue(null);
    db.journalEntry.findMany.mockResolvedValue([]);
    db.journalEntry.count.mockResolvedValue(0);
    await expect(
      service.ledger({ page: 1, pageSize: 10, accountId: 'a404' }),
    ).rejects.toMatchObject({ code: 'common.not_found' });
  });

  it('lists every authorization newest first with its customer, filtered by status', async () => {
    const authorization = (id: string, account: unknown) => ({
      id,
      accountId: account ? 'a1' : null,
      amountCents: 1_000n,
      capturedCents: 0n,
      status: account ? 'APPROVED' : 'DECLINED',
      declineReason: account ? null : 'invalid_card',
      merchantName: 'Taquería El Sol',
      merchantMcc: '5812',
      items: [{ sku: 'TAQ-PASTOR', name: 'Tacos', quantity: 1, unitCents: '1000' }],
      createdAt: NOW,
      updatedAt: NOW,
      account,
    });
    db.authorization.findMany.mockResolvedValue([
      authorization('z2', { customer: CUSTOMER }),
      authorization('z1', null),
    ]);
    db.authorization.count.mockResolvedValue(2);
    const page = await service.listAuthorizations({ page: 1, pageSize: 10, status: 'DECLINED' });
    expect(page).toMatchObject({ total: 2, totalPages: 1 });
    const declinedOnly = { AND: [{ status: 'DECLINED' }, {}] };
    expect(db.authorization.count).toHaveBeenCalledWith({ where: declinedOnly });
    expect(page.items[0]).toMatchObject({ id: 'z2', customer: CUSTOMER, amountCents: '1000' });
    expect(page.items[0]).not.toHaveProperty('account');
    expect(page.items[0]?.items).toEqual([
      { sku: 'TAQ-PASTOR', name: 'Tacos', quantity: 1, unitCents: '1000' },
    ]);
    expect(page.items[1]).toMatchObject({ id: 'z1', accountId: null, customer: null });
    expect(db.authorization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: declinedOnly,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 10,
      }),
    );
    await service.listAuthorizations({ page: 1, pageSize: 10 });
    expect(db.authorization.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { AND: [{}, {}] } }),
    );
  });

  it('filters the audit log by entity', async () => {
    const entry = {
      id: 'l1',
      actorType: 'admin',
      actorId: 'u9',
      action: 'account.frozen',
      entityType: 'account',
      entityId: 'a1',
      requestId: 'r1',
      data: { from: 'ACTIVE' },
      createdAt: NOW,
    };
    db.auditLog.findMany.mockResolvedValue([entry]);
    db.auditLog.count.mockResolvedValue(1);
    await expect(
      service.auditLog({ page: 1, pageSize: 10, entityId: 'a1' }),
    ).resolves.toMatchObject({ items: [{ id: 'l1' }], total: 1 });
    const entityOnly = { AND: [{ entityId: 'a1' }, {}] };
    expect(db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: entityOnly }),
    );
    expect(db.auditLog.count).toHaveBeenCalledWith({ where: entityOnly });
    await service.auditLog({ page: 1, pageSize: 10 });
    expect(toAuditLogEntry({ ...entry, data: ['not', 'an', 'object'] } as never).data).toEqual({});
  });
});
