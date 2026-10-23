import { ACCOUNT_STATUSES, type Account } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activeAccount,
  createUser,
  openAccount,
  purchase,
  signedPost,
  startHarness,
  type Harness,
  type TestUser,
} from './support/harness';

/**
 * Numbered pagination on every list (owner decision: pages of at most 10 rows), the structured
 * activity payload, the customer order detail and the one-statement dashboard, against the
 * real database: OFFSET order, totals, index-backed filters and ownership are data rules (FT6).
 */

const ACTIVITY_KEYS = [
  'amountCents',
  'createdAt',
  'description',
  'id',
  'itemCount',
  'items',
  'merchantName',
  'status',
  'type',
];
const LINE_KEYS = ['lineTotalCents', 'name', 'quantity', 'sku', 'unitPriceCents'];
const DETAIL_KEYS = [
  'accountId',
  'amountCents',
  'capturedCents',
  'createdAt',
  'declineReason',
  'expiresAt',
  'id',
  'itemCount',
  'items',
  'merchantMcc',
  'merchantName',
  'reversalReason',
  'status',
  'timeline',
  'updatedAt',
];
const TIMELINE_KEYS = ['approvedAt', 'capturedAt', 'createdAt', 'declinedAt', 'reversedAt'];

/** Many rows share ONE instant: the id tiebreaker alone must keep pages stable. */
const SHARED_INSTANT = new Date('2026-10-20T09:30:00.000Z');

let h: Harness;
let owner: TestUser;
let account: Account;

const PAGE_KEYS = ['items', 'page', 'pageSize', 'total', 'totalPages'];

interface PageItem {
  id: string;
  createdAt?: string;
  openedAt?: string;
}

interface PageBody {
  items: PageItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function pageUrl(path: string, page: number, pageSize: number): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}page=${page}&pageSize=${pageSize}`;
}

/**
 * Reads pages 1..N and the page after the last. Every page carries the exact total; every page
 * but the last is full; the page past the end is empty with the same total (not an error).
 */
async function walk(
  path: string,
  user: TestUser,
  pageSize: number,
  total: number,
): Promise<PageItem[]> {
  const fullPages = Math.floor(total / pageSize);
  const rest = total % pageSize;
  const totalPages = Math.max(1, fullPages + (rest > 0 ? 1 : 0));
  const items: PageItem[] = [];
  for (let page = 1; page <= totalPages + 1; page += 1) {
    const url = pageUrl(path, page, pageSize);
    const res = await h.http.get(url).set(user.auth);
    expect(res.status, url).toBe(200);
    const body = res.body as PageBody;
    expect(Object.keys(body).sort(), url).toEqual(PAGE_KEYS);
    const { items: pageItems, ...meta } = body;
    expect(meta, url).toEqual({ page, pageSize, total, totalPages });
    const expected = page <= fullPages ? pageSize : page === fullPages + 1 ? rest : 0;
    expect(pageItems, url).toHaveLength(expected);
    items.push(...pageItems);
  }
  return items;
}

/** No gaps, no duplicates, newest first with the id as the tiebreaker, across page borders. */
async function expectStableWalk(
  path: string,
  user: TestUser,
  pageSize: number,
  total: number,
): Promise<string[]> {
  const walked = await walk(path, user, pageSize, total);
  const ids = walked.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(total);
  // ISO instants in UTC and lowercase uuids both sort as text the way Postgres sorts them.
  const keys = walked.map((item) => `${item.createdAt ?? item.openedAt ?? ''}|${item.id}`);
  expect(keys).toEqual([...keys].sort().reverse());
  return ids;
}

function storePurchase(cardToken: string) {
  return signedPost(
    h,
    'network',
    '/v1/network/authorizations',
    {
      cardToken,
      amountCents: '1150',
      merchant: { name: 'Taquería El Sol', mcc: '5812' },
      items: [
        { sku: 'TAQ-PASTOR', name: 'Tacos al pastor', quantity: 3, unitCents: '250' },
        { sku: 'AGUA-1', name: 'Agua fresca', quantity: 1, unitCents: '400' },
      ],
    },
    { 'Idempotency-Key': randomUUID() },
  );
}

beforeAll(async () => {
  h = await startHarness();
  owner = await createUser(h);
  account = await activeAccount(h, owner, '50000');
  // 9 purchases, 4 deposits and 3 repayments at the SAME instant, across three tables.
  await h.db.authorization.createMany({
    data: Array.from({ length: 9 }, (_, n) => ({
      accountId: account.id,
      amountCents: BigInt(100 + n),
      status: 'DECLINED' as const,
      declineReason: 'insufficient_funds' as const,
      merchantName: `Shop ${n}`,
      merchantMcc: '5411',
      createdAt: SHARED_INSTANT,
    })),
  });
  await h.db.collateralDeposit.createMany({
    data: Array.from({ length: 4 }, (_, n) => ({
      accountId: account.id,
      amountCents: BigInt(20_000 + n),
      limitRatioBps: 10_000,
      status: 'FAILED' as const,
      providerPaymentId: `pay_shared_${n}_${randomUUID()}`,
      approveUrl: 'http://provider.test/pay',
      createdAt: SHARED_INSTANT,
      expiresAt: SHARED_INSTANT,
    })),
  });
  await h.db.repayment.createMany({
    data: Array.from({ length: 3 }, (_, n) => ({
      accountId: account.id,
      amountCents: BigInt(500 + n),
      status: 'FAILED' as const,
      providerPaymentId: `rep_shared_${n}_${randomUUID()}`,
      approveUrl: 'http://provider.test/pay',
      createdAt: SHARED_INSTANT,
      expiresAt: SHARED_INSTANT,
    })),
  });
});

afterAll(async () => {
  await h.close();
});

describe('customer lists walk every row once, even when rows share createdAt', () => {
  it('activity: deposits, purchases and repayments merged newest first, page by page', async () => {
    const where = { accountId: account.id };
    const total =
      (await h.db.collateralDeposit.count({ where })) +
      (await h.db.authorization.count({ where })) +
      (await h.db.repayment.count({ where }));
    expect(total).toBe(17); // the activation deposit + 16 rows sharing one instant
    // 17 rows: two pages of 10 (the second holds 7), and a size that splits the shared instant.
    const byTen = await expectStableWalk(`/v1/accounts/${account.id}/activity`, owner, 10, total);
    const byThree = await expectStableWalk(`/v1/accounts/${account.id}/activity`, owner, 3, total);
    expect(byThree).toEqual(byTen);
  });

  it('authorizations, deposits and repayments of the account', async () => {
    const where = { accountId: account.id };
    await expectStableWalk(
      `/v1/accounts/${account.id}/authorizations`,
      owner,
      4,
      await h.db.authorization.count({ where }),
    );
    await expectStableWalk(
      `/v1/accounts/${account.id}/deposits`,
      owner,
      2,
      await h.db.collateralDeposit.count({ where: { ...where, providerPaymentId: { not: null } } }),
    );
    await expectStableWalk(
      `/v1/accounts/${account.id}/repayments`,
      owner,
      2,
      await h.db.repayment.count({ where: { ...where, providerPaymentId: { not: null } } }),
    );
  });

  it('no params is page 1 of 10, the same rows as ?page=1&pageSize=10', async () => {
    const path = `/v1/accounts/${account.id}/activity`;
    const bare = await h.http.get(path).set(owner.auth);
    expect(bare.status).toBe(200);
    expect(Object.keys(bare.body as object).sort()).toEqual(PAGE_KEYS);
    expect(bare.body).toMatchObject({ page: 1, pageSize: 10, total: 17, totalPages: 2 });
    const explicit = await h.http.get(pageUrl(path, 1, 10)).set(owner.auth);
    expect((bare.body as PageBody).items).toEqual((explicit.body as PageBody).items);
    expect((bare.body as PageBody).items).toHaveLength(10);
  });

  it('a page past the end is empty with the real total, not an error', async () => {
    const res = await h.http
      .get(pageUrl(`/v1/accounts/${account.id}/activity`, 99, 10))
      .set(owner.auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 99, pageSize: 10, total: 17, totalPages: 2 });
  });

  it('an account with no rows has one empty page', async () => {
    const newcomer = await createUser(h);
    const opened = await openAccount(h, newcomer);
    const res = await h.http.get(`/v1/accounts/${opened.id}/repayments`).set(newcomer.auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  });

  it('another customer gets 404 on every list of the account, whatever the page', async () => {
    const stranger = await createUser(h);
    for (const list of ['activity', 'authorizations', 'deposits', 'repayments']) {
      const res = await h.http
        .get(pageUrl(`/v1/accounts/${account.id}/${list}`, 2, 10))
        .set(stranger.auth);
      expect(res.status, list).toBe(404);
      expect(res.body).toMatchObject({ code: 'common.not_found' });
    }
  });
});

describe('page and pageSize validation (common.validation_failed, 422)', () => {
  const path = () => `/v1/accounts/${account.id}/activity`;

  it('accepts pageSize 1 and 10, refuses 0 and 11 with the pageSize issue', async () => {
    for (const size of [1, 10]) {
      const res = await h.http.get(`${path()}?pageSize=${size}`).set(owner.auth);
      expect(res.status, String(size)).toBe(200);
      expect((res.body as PageBody).items).toHaveLength(size);
    }
    for (const size of ['0', '11']) {
      const res = await h.http.get(`${path()}?pageSize=${size}`).set(owner.auth);
      expect(res.status, size).toBe(422);
      expect(res.body).toMatchObject({
        code: 'common.validation_failed',
        details: { issues: [expect.objectContaining({ path: 'pageSize' })] },
      });
    }
  });

  it('accepts page 1, refuses page 0 and anything that is not plain digits', async () => {
    expect((await h.http.get(`${path()}?page=1`).set(owner.auth)).status).toBe(200);
    for (const page of ['0', '-1', '1.5', '1e1', 'two', '']) {
      const res = await h.http.get(`${path()}?page=${page}`).set(owner.auth);
      expect(res.status, page).toBe(422);
      expect(res.body).toMatchObject({
        code: 'common.validation_failed',
        details: { issues: [expect.objectContaining({ path: 'page' })] },
      });
    }
  });

  it('refuses unknown keys, including the retired cursor contract', async () => {
    for (const query of ['limit=5', 'cursor=abc', 'extra=1']) {
      const res = await h.http.get(`${path()}?${query}`).set(owner.auth);
      expect(res.status, query).toBe(422);
      expect(res.body).toMatchObject({ code: 'common.validation_failed' });
    }
  });

  it('applies the same rules on admin lists (one shared query schema)', async () => {
    const admin = await createUser(h, 'admin');
    for (const list of ['/v1/admin/ledger', '/v1/admin/accounts?status=ACTIVE']) {
      expect((await h.http.get(pageUrl(list, 1, 10)).set(admin.auth)).status, list).toBe(200);
      const res = await h.http.get(pageUrl(list, 1, 11)).set(admin.auth);
      expect(res.status, list).toBe(422);
      expect(res.body).toMatchObject({ code: 'common.validation_failed' });
    }
  });
});

describe('structured activity (no English text to parse)', () => {
  it('carries merchant, item count and priced lines; the legacy description stays', async () => {
    const shopper = await createUser(h);
    const shopperAccount = await activeAccount(h, shopper, '20000');
    const bought = await storePurchase(shopperAccount.card?.token ?? '');
    expect(bought.status).toBe(201);
    const res = await h.http
      .get(`/v1/accounts/${shopperAccount.id}/activity?pageSize=2`)
      .set(shopper.auth);
    expect(res.status).toBe(200);
    const [store, deposit] = (res.body as { items: Record<string, unknown>[] }).items;
    for (const item of [store, deposit])
      expect(Object.keys(item ?? {}).sort()).toEqual(ACTIVITY_KEYS);
    expect(store).toMatchObject({
      type: 'purchase',
      amountCents: '1150',
      description: 'Taquería El Sol · 4 items',
      merchantName: 'Taquería El Sol',
      itemCount: 4,
      items: [
        {
          sku: 'TAQ-PASTOR',
          name: 'Tacos al pastor',
          quantity: 3,
          unitPriceCents: '250',
          lineTotalCents: '750',
        },
        {
          sku: 'AGUA-1',
          name: 'Agua fresca',
          quantity: 1,
          unitPriceCents: '400',
          lineTotalCents: '400',
        },
      ],
    });
    for (const line of (store?.items as object[]) ?? []) {
      expect(Object.keys(line).sort()).toEqual(LINE_KEYS);
    }
    expect(deposit).toMatchObject({ type: 'deposit', merchantName: null, itemCount: 0, items: [] });
  });
});

describe('GET /v1/accounts/:id/authorizations/:authorizationId (order detail)', () => {
  it('shows the owner a captured store purchase: exact keys, lines, totals and timeline', async () => {
    const shopper = await createUser(h);
    const shopperAccount = await activeAccount(h, shopper, '20000');
    const bought = await storePurchase(shopperAccount.card?.token ?? '');
    const id = bought.body.id as string;
    const captured = await signedPost(
      h,
      'network',
      `/v1/network/authorizations/${id}/capture`,
      { amountCents: '1150' },
      { 'Idempotency-Key': randomUUID() },
    );
    expect(captured.status).toBe(201);

    const res = await h.http
      .get(`/v1/accounts/${shopperAccount.id}/authorizations/${id}`)
      .set(shopper.auth);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(Object.keys(res.body as object).sort()).toEqual(DETAIL_KEYS);
    expect(Object.keys(res.body.timeline as object).sort()).toEqual(TIMELINE_KEYS);
    const audit = await h.db.auditLog.findFirstOrThrow({
      where: { entityId: id, action: 'authorization.captured' },
      select: { createdAt: true },
    });
    expect(res.body).toMatchObject({
      id,
      accountId: shopperAccount.id,
      status: 'CAPTURED',
      declineReason: null,
      merchantName: 'Taquería El Sol',
      merchantMcc: '5812',
      amountCents: '1150',
      capturedCents: '1150',
      itemCount: 4,
      timeline: {
        createdAt: bought.body.createdAt,
        approvedAt: bought.body.createdAt,
        declinedAt: null,
        capturedAt: audit.createdAt.toISOString(),
        reversedAt: null,
      },
    });
    expect((res.body.items as object[]).map((line) => Object.keys(line).sort())).toEqual([
      LINE_KEYS,
      LINE_KEYS,
    ]);
  });

  it("answers 404 for someone else's purchase, a purchase of another account and an unknown id", async () => {
    const stranger = await createUser(h);
    const strangerAccount = await activeAccount(h, stranger, '20000');
    const theirs = await purchase(h, strangerAccount.card?.token ?? '', '700');
    const theirId = theirs.body.id as string;
    // The stranger sees it, so the id is real.
    const visible = await h.http
      .get(`/v1/accounts/${strangerAccount.id}/authorizations/${theirId}`)
      .set(stranger.auth);
    expect(visible.status).toBe(200);
    const attempts = [
      `/v1/accounts/${strangerAccount.id}/authorizations/${theirId}`,
      `/v1/accounts/${account.id}/authorizations/${theirId}`,
      `/v1/accounts/${account.id}/authorizations/${randomUUID()}`,
    ];
    for (const path of attempts) {
      const res = await h.http.get(path).set(owner.auth);
      expect(res.status, path).toBe(404);
      expect(res.body).toMatchObject({ code: 'common.not_found' });
    }
  });

  it('is customer-only and validates the ids', async () => {
    const own = await h.db.authorization.findFirstOrThrow({
      where: { accountId: account.id },
      select: { id: true },
    });
    const path = `/v1/accounts/${account.id}/authorizations/${own.id}`;
    expect((await h.http.get(path).set(owner.auth)).status).toBe(200);
    expect((await h.http.get(path)).status).toBe(401);
    const admin = await createUser(h, 'admin');
    const forbidden = await h.http.get(path).set(admin.auth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ code: 'common.forbidden' });
    const malformed = await h.http
      .get(`/v1/accounts/${account.id}/authorizations/not-a-uuid`)
      .set(owner.auth);
    expect(malformed.status).toBe(422);
    expect(malformed.body).toMatchObject({ code: 'common.validation_failed' });
  });
});

describe('admin lists walk every row once', () => {
  let admin: TestUser;

  beforeAll(async () => {
    admin = await createUser(h, 'admin');
    // Rows sharing one instant in each global list.
    for (let n = 0; n < 3; n += 1) {
      const customer = await createUser(h);
      await h.db.account.create({
        data: { customerId: customer.id, openedAt: SHARED_INSTANT },
        select: { id: true },
      });
    }
    await h.db.auditLog.createMany({
      data: Array.from({ length: 5 }, (_, n) => ({
        actorType: 'system' as const,
        action: 'pagination.check',
        entityType: 'account',
        entityId: account.id,
        data: { n },
        createdAt: SHARED_INSTANT,
      })),
    });
    for (let n = 0; n < 4; n += 1) {
      await h.db.journalEntry.create({
        data: {
          kind: 'purchase_capture',
          accountId: account.id,
          description: `Shared instant ${n}`,
          createdAt: SHARED_INSTANT,
          // Global ledger accounts only: the account's own cached balances stay reconciled.
          postings: {
            create: [
              { ledgerAccount: 'cash_clearing', amountCents: 10n },
              { ledgerAccount: 'merchant_settlement', amountCents: -10n },
            ],
          },
        },
        select: { id: true },
      });
    }
  });

  it('accounts, all and by status', async () => {
    await expectStableWalk('/v1/admin/accounts', admin, 7, await h.db.account.count());
    await expectStableWalk(
      '/v1/admin/accounts?status=PENDING_COLLATERAL',
      admin,
      2,
      await h.db.account.count({ where: { status: 'PENDING_COLLATERAL' } }),
    );
  });

  it('authorizations (purchases), all and by status', async () => {
    await expectStableWalk('/v1/admin/authorizations', admin, 10, await h.db.authorization.count());
    await expectStableWalk(
      '/v1/admin/authorizations?status=DECLINED',
      admin,
      5,
      await h.db.authorization.count({ where: { status: 'DECLINED' } }),
    );
  });

  it('ledger, global and of one account, and the audit log, global and of one entity', async () => {
    await expectStableWalk('/v1/admin/ledger', admin, 10, await h.db.journalEntry.count());
    await expectStableWalk(
      `/v1/admin/accounts/${account.id}/ledger`,
      admin,
      2,
      await h.db.journalEntry.count({ where: { accountId: account.id } }),
    );
    await expectStableWalk(
      `/v1/admin/accounts/${account.id}/authorizations`,
      admin,
      4,
      await h.db.authorization.count({ where: { accountId: account.id } }),
    );
    await expectStableWalk('/v1/admin/audit-log', admin, 10, await h.db.auditLog.count());
    await expectStableWalk(
      `/v1/admin/audit-log?entityId=${account.id}`,
      admin,
      3,
      await h.db.auditLog.count({ where: { entityId: account.id } }),
    );
  });

  it('answers 404 for the ledger or purchases of an unknown account', async () => {
    for (const path of [
      `/v1/admin/accounts/${randomUUID()}/ledger`,
      `/v1/admin/accounts/${randomUUID()}/authorizations`,
    ]) {
      const res = await h.http.get(path).set(admin.auth);
      expect(res.status, path).toBe(404);
      expect(res.body).toMatchObject({ code: 'common.not_found' });
    }
  });
});

describe('admin dashboard (one aggregate statement)', () => {
  it('moves by exactly what happened between two reads', async () => {
    const admin = await createUser(h, 'admin');
    const read = async () => (await h.http.get('/v1/admin/dashboard').set(admin.auth)).body;
    const before = await read();
    const pending = await createUser(h);
    await openAccount(h, pending);
    const buyer = await createUser(h);
    const active = await activeAccount(h, buyer, '30000');
    expect((await purchase(h, active.card?.token ?? '', '2500')).body.status).toBe('APPROVED');
    // Two declines and one approval, so swapping the two counts cannot go unnoticed.
    for (const token of ['card_unknown_token_000000000000', 'card_unknown_token_000000000001']) {
      expect((await purchase(h, token, '100')).body.status).toBe('DECLINED');
    }
    // A decision older than 24 hours is outside the window.
    await h.db.authorization.create({
      data: {
        amountCents: 100n,
        status: 'DECLINED',
        declineReason: 'invalid_card',
        merchantName: 'Old Shop',
        merchantMcc: '5411',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    const after = await read();

    const delta = (field: string) =>
      BigInt(after[field] as string) - BigInt(before[field] as string);
    expect(Object.keys(after.accountsByStatus as object).sort()).toEqual(
      [...ACCOUNT_STATUSES].sort(),
    );
    expect(
      after.accountsByStatus.PENDING_COLLATERAL - before.accountsByStatus.PENDING_COLLATERAL,
    ).toBe(1);
    expect(after.accountsByStatus.ACTIVE - before.accountsByStatus.ACTIVE).toBe(1);
    expect(delta('collateralHeldCents')).toBe(30_000n);
    expect(delta('creditLimitCents')).toBe(30_000n);
    expect(delta('heldCents')).toBe(2_500n);
    expect(delta('receivableCents')).toBe(0n);
    expect(after.authorizationsLast24h.approved - before.authorizationsLast24h.approved).toBe(1);
    expect(after.authorizationsLast24h.declined - before.authorizationsLast24h.declined).toBe(2);
    expect(after.ledgerTrialBalanceCents).toBe('0');
  });
});
