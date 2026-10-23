import { ACCOUNT_STATUSES } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activeAccount,
  createUser,
  key,
  purchase,
  signedPost,
  startHarness,
  type Harness,
  type TestUser,
} from './support/harness';

let h: Harness;
let admin: TestUser;

beforeAll(async () => {
  h = await startHarness();
  admin = await createUser(h, 'admin');
});

afterAll(async () => {
  await h.close();
});

describe('admin back office (R-50, R-51)', () => {
  it('is admin-only: 401 without a session, 403 for a customer', async () => {
    const anonymous = await h.http.get('/v1/admin/dashboard');
    expect(anonymous.status).toBe(401);
    const customer = await createUser(h);
    const forbidden = await h.http.get('/v1/admin/dashboard').set(customer.auth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ code: 'common.forbidden' });
  });

  it('shows the dashboard with a zero trial balance', async () => {
    const customer = await createUser(h);
    const account = await activeAccount(h, customer, '20000');
    await purchase(h, account.card?.token ?? '', '2500');
    await purchase(h, account.card?.token ?? '', '99999');
    const res = await h.http.get('/v1/admin/dashboard').set(admin.auth);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.accountsByStatus).sort()).toEqual([...ACCOUNT_STATUSES].sort());
    expect(res.body.ledgerTrialBalanceCents).toBe('0');
    expect(res.body.authorizationsLast24h.approved).toBeGreaterThanOrEqual(1);
    expect(res.body.authorizationsLast24h.declined).toBeGreaterThanOrEqual(1);
    expect(BigInt(res.body.heldCents as string)).toBeGreaterThanOrEqual(2500n);
  });

  it('finds an account by the customer email and shows it with its purchases, ledger and audit', async () => {
    const customer = await createUser(h);
    const account = await activeAccount(h, customer, '20000');
    const auth = await purchase(h, account.card?.token ?? '', '1234');

    const list = await h.http
      .get(`/v1/admin/accounts?q=${encodeURIComponent(customer.email.toUpperCase())}&status=ACTIVE`)
      .set(admin.auth);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      id: account.id,
      customer: { id: customer.id, email: customer.email },
      cardLast4: account.card?.last4,
    });
    expect(list.body.items[0]).not.toHaveProperty('card');

    const detail = await h.http.get(`/v1/admin/accounts/${account.id}`).set(admin.auth);
    expect(detail.body).toMatchObject({ id: account.id, heldCents: '1234' });

    const authorizations = await h.http
      .get(`/v1/admin/accounts/${account.id}/authorizations`)
      .set(admin.auth);
    expect(authorizations.body.items).toMatchObject([{ id: auth.body.id, amountCents: '1234' }]);

    const ledger = await h.http.get(`/v1/admin/accounts/${account.id}/ledger`).set(admin.auth);
    expect(ledger.body.items).toMatchObject([
      {
        kind: 'collateral_deposit',
        postings: [
          { ledgerAccount: 'cash_clearing', amountCents: '20000' },
          { ledgerAccount: `collateral:${account.id}`, amountCents: '-20000' },
        ],
      },
    ]);
    const global = await h.http.get('/v1/admin/ledger?pageSize=1').set(admin.auth);
    expect(global.body.items).toHaveLength(1);

    const audit = await h.http
      .get(`/v1/admin/audit-log?entityId=${auth.body.id as string}`)
      .set(admin.auth);
    expect(audit.body.items).toMatchObject([
      { action: 'authorization.approved', actorType: 'network', entityType: 'authorization' },
    ]);

    const missing = await h.http.get(`/v1/admin/accounts/${randomUUID()}`).set(admin.auth);
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'common.not_found' });
  });

  it('lists every authorization newest first with its customer and lines, by status', async () => {
    const anonymous = await h.http.get('/v1/admin/authorizations');
    expect(anonymous.status).toBe(401);
    const customer = await createUser(h);
    const forbidden = await h.http.get('/v1/admin/authorizations').set(customer.auth);
    expect(forbidden.status).toBe(403);

    const account = await activeAccount(h, customer, '20000');
    const lines = [{ sku: 'MKT-COFFEE', name: 'Coffee', quantity: 2, unitCents: '450' }];
    const store = await signedPost(
      h,
      'network',
      '/v1/network/authorizations',
      {
        cardToken: account.card?.token ?? '',
        amountCents: '900',
        merchant: { name: 'Mercado', mcc: '5411' },
        items: lines,
      },
      { 'Idempotency-Key': randomUUID() },
    );
    const invalid = await purchase(h, `card_${'q'.repeat(24)}`, '100');

    const all = await h.http.get('/v1/admin/authorizations?pageSize=2').set(admin.auth);
    expect(all.status).toBe(200);
    expect(all.body.items).toMatchObject([
      { id: invalid.body.id, accountId: null, customer: null, items: [] },
      {
        id: store.body.id,
        accountId: account.id,
        items: lines,
        customer: { id: customer.id, email: customer.email, fullName: expect.any(String) },
      },
    ]);
    expect(all.body.items[1]).not.toHaveProperty('account');
    expect(all.body).toMatchObject({ page: 1, pageSize: 2 });
    expect(all.body.totalPages).toBeGreaterThan(1);

    const approved = await h.http.get('/v1/admin/authorizations?status=APPROVED').set(admin.auth);
    expect(
      approved.body.items.every((item: { status: string }) => item.status === 'APPROVED'),
    ).toBe(true);
    expect(approved.body.items.map((item: { id: string }) => item.id)).toContain(store.body.id);

    const bad = await h.http.get('/v1/admin/authorizations?status=PENDING').set(admin.auth);
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ code: 'common.validation_failed' });

    const perAccount = await h.http
      .get(`/v1/admin/accounts/${account.id}/authorizations`)
      .set(admin.auth);
    expect(perAccount.body.items).toMatchObject([{ id: store.body.id, items: lines }]);
  });

  it('freezes, unfreezes and closes any account, audited as the admin', async () => {
    const customer = await createUser(h);
    const account = await activeAccount(h, customer, '20000');
    const act = (action: string) =>
      h.http.post(`/v1/admin/accounts/${account.id}/${action}`).set(admin.auth).set(key());
    expect((await act('freeze')).body).toMatchObject({ status: 'FROZEN' });
    expect((await act('unfreeze')).body).toMatchObject({ status: 'ACTIVE' });
    const closed = await act('close');
    expect(closed.status).toBe(200);
    expect(closed.body.settlement).toEqual({
      collateralCents: '20000',
      appliedToDebtCents: '0',
      releasedCents: '20000',
    });
    const audit = await h.db.auditLog.findMany({
      where: { entityId: account.id, action: { in: ['account.frozen', 'account.closed'] } },
      select: { actorType: true, actorId: true },
    });
    expect(audit).toEqual([
      { actorType: 'admin', actorId: admin.id },
      { actorType: 'admin', actorId: admin.id },
    ]);
  });
});

/**
 * A5 / FT20: the card token is the credential a purchase is made with. The attacker is anyone
 * with back-office access (or its logs): no admin answer may carry it, replays included.
 */
describe('admin account answers: last 4 only, never the card token (A5)', () => {
  const ACCOUNT_KEYS = [
    'activatedAt',
    'availableCents',
    'card',
    'closedAt',
    'collateralCents',
    'creditLimitCents',
    'currency',
    'frozenBy',
    'heldCents',
    'id',
    'openedAt',
    'postedDebtCents',
    'status',
  ];
  const ADMIN_ACCOUNT_KEYS = [
    'activatedAt',
    'availableCents',
    'cardLast4',
    'closedAt',
    'collateralCents',
    'creditLimitCents',
    'currency',
    'customer',
    'freezeReason',
    'frozenBy',
    'heldCents',
    'id',
    'openedAt',
    'postedDebtCents',
    'status',
  ];
  const keysOf = (body: object) => Object.keys(body).sort();

  it('detail, list, freeze (and its replay), unfreeze and close answer exact keys', async () => {
    const customer = await createUser(h);
    const account = await activeAccount(h, customer, '20000');
    const token = account.card?.token ?? '';
    expect(token).not.toBe('');
    const act = (action: string, idempotency = key()) =>
      h.http.post(`/v1/admin/accounts/${account.id}/${action}`).set(admin.auth).set(idempotency);

    const list = await h.http
      .get(`/v1/admin/accounts?q=${encodeURIComponent(customer.email)}`)
      .set(admin.auth);
    const detail = await h.http.get(`/v1/admin/accounts/${account.id}`).set(admin.auth);
    const freezeKey = key();
    const frozen = await act('freeze', freezeKey);
    const replayed = await act('freeze', freezeKey);
    const unfrozen = await act('unfreeze');
    const closed = await act('close');

    expect([list, detail, frozen, replayed, unfrozen, closed].map((res) => res.status)).toEqual([
      200, 200, 200, 200, 200, 200,
    ]);
    expect(keysOf(list.body.items[0])).toEqual(ADMIN_ACCOUNT_KEYS);
    // The detail adds the account's payouts (H2) to the list row.
    expect(keysOf(detail.body)).toEqual([...ADMIN_ACCOUNT_KEYS, 'payouts'].sort());
    expect(detail.body.cardLast4).toBe(account.card?.last4);
    for (const body of [frozen.body, replayed.body, unfrozen.body, closed.body.account]) {
      expect(keysOf(body)).toEqual(ACCOUNT_KEYS);
      expect(keysOf(body.card)).toEqual(['expiresMonth', 'last4']);
      expect(body.card.last4).toBe(account.card?.last4);
    }
    expect(replayed.body).toEqual(frozen.body);
    expect(keysOf(closed.body)).toEqual(['account', 'settlement']);
    for (const res of [list, detail, frozen, replayed, unfrozen, closed]) {
      expect(JSON.stringify(res.body)).not.toContain(token);
    }
  });
});
