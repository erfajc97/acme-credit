import { ADMIN_SEARCH_MAX } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Account } from '@acme/contracts';
import {
  activeAccount,
  createUser,
  purchase,
  startHarness,
  type Harness,
  type TestUser,
} from './support/harness';

/**
 * The search box of every back-office table (`?q=`). The database is shared by the whole suite,
 * so every fixture carries a unique value and each search asserts the EXACT total: a filter that
 * is dropped (or an OR that matches everything) shows up as a wrong count, not a missing row.
 */
let h: Harness;
let admin: TestUser;
let customer: TestUser;
let account: Account;
let purchaseId: string;

/** The first 23 characters of a uuid v7 reach its random bits: unique, yet still a prefix. */
const prefixOf = (id: string) => id.slice(0, 23);

async function search(path: string, q: string) {
  const separator = path.includes('?') ? '&' : '?';
  const res = await h.http.get(`${path}${separator}q=${encodeURIComponent(q)}`).set(admin.auth);
  expect(res.status).toBe(200);
  return res.body as { items: { id: string }[]; total: number };
}

beforeAll(async () => {
  h = await startHarness();
  admin = await createUser(h, 'admin');
  customer = await createUser(h);
  account = await activeAccount(h, customer, '20000');
  const approved = await purchase(h, account.card?.token ?? '', '1500');
  purchaseId = approved.body.id as string;
});

afterAll(async () => {
  await h.close();
});

describe('GET /v1/admin/accounts?q=', () => {
  it('matches the account id (full or prefix) and the customer email; a miss is empty', async () => {
    const byId = await search('/v1/admin/accounts', account.id.toUpperCase());
    expect(byId.total).toBe(1);
    expect(byId.items.map((item) => item.id)).toEqual([account.id]);
    expect((await search('/v1/admin/accounts', prefixOf(account.id))).total).toBe(1);
    expect((await search('/v1/admin/accounts', customer.email)).total).toBe(1);
    expect((await search('/v1/admin/accounts', randomUUID())).total).toBe(0);
  });

  it('validates q: 100 characters pass, 101 are a 422, blank is no search', async () => {
    expect((await search('/v1/admin/accounts', 'z'.repeat(ADMIN_SEARCH_MAX))).total).toBe(0);
    const tooLong = await h.http
      .get(`/v1/admin/accounts?q=${'z'.repeat(ADMIN_SEARCH_MAX + 1)}`)
      .set(admin.auth);
    expect(tooLong.status).toBe(422);
    expect(tooLong.body).toMatchObject({ code: 'common.validation_failed' });
    const all = await h.http.get('/v1/admin/accounts').set(admin.auth);
    expect((await search('/v1/admin/accounts', '   ')).total).toBe(all.body.total);
  });

  it('stays admin-only with a q', async () => {
    const res = await h.http.get(`/v1/admin/accounts?q=${account.id}`).set(customer.auth);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'common.forbidden' });
  });
});

describe('GET /v1/admin/authorizations?q= and /v1/admin/accounts/:id/authorizations?q=', () => {
  it('matches id, merchant name and customer; a miss is empty', async () => {
    const merchant = `Search Shop ${randomUUID()}`;
    const declined = await h.db.authorization.create({
      data: {
        amountCents: 700n,
        status: 'DECLINED',
        declineReason: 'invalid_card',
        merchantName: merchant,
        merchantMcc: '5411',
      },
      select: { id: true },
    });
    const global = '/v1/admin/authorizations';
    expect((await search(global, merchant.slice(14).toUpperCase())).items).toMatchObject([
      { id: declined.id },
    ]);
    expect((await search(global, declined.id)).total).toBe(1);
    expect((await search(global, prefixOf(purchaseId))).items).toMatchObject([{ id: purchaseId }]);
    expect((await search(global, customer.email)).total).toBe(1);
    expect((await search(global, randomUUID())).total).toBe(0);
  });

  it('the account list searches inside that account only', async () => {
    const path = `/v1/admin/accounts/${account.id}/authorizations`;
    expect((await search(path, 'corner grocery')).items).toMatchObject([{ id: purchaseId }]);
    expect((await search(path, purchaseId)).total).toBe(1);
    expect((await search(path, 'no such merchant')).total).toBe(0);
    const other = await activeAccount(h, await createUser(h), '20000');
    const foreign = await search(`/v1/admin/accounts/${other.id}/authorizations`, purchaseId);
    expect(foreign.total).toBe(0);
  });
});

describe('GET /v1/admin/payouts?q=', () => {
  it('matches payout id, provider reference, provider payment id and customer', async () => {
    const providerPaymentId = `pp-${randomUUID()}`;
    const payout = await h.db.payout.create({
      data: {
        accountId: account.id,
        amountCents: 300n,
        reason: 'collateral_release',
        providerPaymentId,
      },
      select: { id: true, providerReference: true },
    });
    const path = '/v1/admin/payouts';
    expect((await search(path, payout.id)).items).toMatchObject([{ id: payout.id }]);
    expect((await search(path, prefixOf(payout.id))).total).toBe(1);
    expect((await search(path, payout.providerReference)).total).toBe(1);
    expect((await search(path, providerPaymentId.toUpperCase())).total).toBe(1);
    expect((await search(path, customer.email)).total).toBe(1);
    expect((await search(path, randomUUID())).total).toBe(0);
  });
});

describe('GET /v1/admin/ledger?q= and /v1/admin/accounts/:id/ledger?q=', () => {
  it('matches entry id, account id, kind and description; a miss is empty', async () => {
    const entries = await h.db.journalEntry.findMany({
      where: { accountId: account.id },
      select: { id: true, kind: true, description: true },
    });
    const deposit = entries.find((entry) => entry.kind === 'collateral_deposit');
    if (!deposit) throw new Error('the active account has no deposit entry');
    expect((await search('/v1/admin/ledger', account.id)).total).toBe(entries.length);
    expect((await search('/v1/admin/ledger', deposit.id)).items).toMatchObject([
      { id: deposit.id },
    ]);
    expect((await search('/v1/admin/ledger', randomUUID())).total).toBe(0);

    const scoped = `/v1/admin/accounts/${account.id}/ledger`;
    expect((await search(scoped, 'COLLATERAL_DEP')).items).toMatchObject([{ id: deposit.id }]);
    expect((await search(scoped, deposit.description.slice(0, 12))).total).toBeGreaterThanOrEqual(
      1,
    );
    expect((await search(scoped, 'purchase_capture')).total).toBe(0);
  });
});

describe('GET /v1/admin/audit-log?q=', () => {
  it('matches action, entity id, actor id and request id, next to entityId', async () => {
    const tag = randomUUID();
    const row = await h.db.auditLog.create({
      data: {
        actorType: 'admin',
        actorId: `actor-${tag}`,
        action: `test.search_${tag.slice(0, 8)}`,
        entityType: 'account',
        entityId: `entity-${tag}`,
        requestId: `req-${tag}`,
        data: {},
      },
      select: { id: true, action: true },
    });
    const path = '/v1/admin/audit-log';
    expect((await search(path, row.action.slice(5))).items).toMatchObject([{ id: row.id }]);
    expect((await search(path, `ENTITY-${tag}`)).total).toBe(1);
    expect((await search(path, `actor-${tag}`)).total).toBe(1);
    expect((await search(path, `req-${tag}`)).total).toBe(1);
    expect((await search(`${path}?entityId=entity-${tag}`, `req-${tag}`)).total).toBe(1);
    expect((await search(`${path}?entityId=other-${tag}`, `req-${tag}`)).total).toBe(0);
    expect((await search(path, randomUUID())).total).toBe(0);
  });
});
