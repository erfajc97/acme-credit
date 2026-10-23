import type { Account } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activeAccount,
  approve,
  createUser,
  deposit,
  key,
  openAccount,
  signedPost,
  startHarness,
  trialBalance,
  webhook,
  type Harness,
  type TestUser,
} from './support/harness';

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

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.close();
});

async function mine(user: TestUser): Promise<Account> {
  return (await h.http.get('/v1/accounts/me').set(user.auth)).body as Account;
}

describe('POST /v1/accounts', () => {
  it('opens a PENDING_COLLATERAL account without a card, answering the exact contract keys', async () => {
    const user = await createUser(h);
    const idempotencyKey = key();
    const res = await h.http.post('/v1/accounts').set(user.auth).set(idempotencyKey);
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(ACCOUNT_KEYS);
    expect(res.body).toMatchObject({
      status: 'PENDING_COLLATERAL',
      currency: 'USD',
      card: null,
      creditLimitCents: '0',
      availableCents: '0',
    });

    const replay = await h.http.post('/v1/accounts').set(user.auth).set(idempotencyKey);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(res.body);
    expect(await h.db.account.count({ where: { customerId: user.id } })).toBe(1);

    const second = await h.http.post('/v1/accounts').set(user.auth).set(key());
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ code: 'account.already_open' });
  });

  it('requires an Idempotency-Key, a session and the customer role', async () => {
    const user = await createUser(h);
    const missing = await h.http.post('/v1/accounts').set(user.auth);
    expect(missing.status).toBe(422);
    expect(missing.body).toMatchObject({ code: 'idempotency.key_required' });
    const malformed = await h.http
      .post('/v1/accounts')
      .set(user.auth)
      .set('Idempotency-Key', 'nope');
    expect(malformed.body).toMatchObject({ code: 'common.validation_failed' });

    const anonymous = await h.http.post('/v1/accounts').set(key());
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toMatchObject({ code: 'common.unauthenticated' });
    const admin = await createUser(h, 'admin');
    const forbidden = await h.http.post('/v1/accounts').set(admin.auth).set(key());
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ code: 'common.forbidden' });
  });

  it('answers 404 on /accounts/me before any account exists', async () => {
    const user = await createUser(h);
    const res = await h.http.get('/v1/accounts/me').set(user.auth);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'common.not_found' });
  });
});

describe('collateral deposits and activation (R-01, R-02)', () => {
  it('accepts USD 200.00 and USD 10,000.00 and refuses one cent outside (boundary pairs)', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const send = (amountCents: string, accountId = account.id, auth = user.auth) =>
      h.http.post(`/v1/accounts/${accountId}/deposits`).set(auth).set(key()).send({ amountCents });

    const low = await send('19999');
    expect(low.status).toBe(422);
    expect(low.body).toMatchObject({ code: 'deposit.amount_out_of_range' });
    expect((await send('20000')).status).toBe(201);
    // The maximum on an account of its own: the per-account cap counts pending deposits too.
    const other = await createUser(h);
    const otherAccount = await openAccount(h, other);
    expect((await send('1000000', otherAccount.id, other.auth)).status).toBe(201);
    const high = await send('1000001');
    expect(high.status).toBe(422);
    expect(high.body).toMatchObject({ code: 'deposit.amount_out_of_range' });
    const floaty = await send('200.00');
    expect(floaty.body).toMatchObject({ code: 'common.validation_failed' });
  });

  it('keeps the card unusable until the provider confirms, then activates with limit = deposit × ratio', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const res = await h.http
      .post(`/v1/accounts/${account.id}/deposits`)
      .set(user.auth)
      .set(key())
      .send({ amountCents: '25050' });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual([
      'accountId',
      'amountCents',
      'checkout',
      'confirmedAt',
      'createdAt',
      'expiresAt',
      'id',
      'limitRatioBps',
      'status',
    ]);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      amountCents: '25050',
      limitRatioBps: 10000,
    });
    expect(res.body.checkout.paymentId).toBe(h.provider.byReference(res.body.id as string).id);
    expect(await mine(user)).toMatchObject({ status: 'PENDING_COLLATERAL', card: null });

    // The provider has not settled yet: the webhook is "not confirmed", nothing moves.
    const early = await webhook(h, res.body.id as string);
    expect(early.status).toBe(409);
    expect(early.body).toMatchObject({ code: 'payment.not_confirmed' });

    const confirmed = await approve(h, res.body.id as string);
    expect(confirmed.status).toBe(204);
    const active = await mine(user);
    expect(active).toMatchObject({
      status: 'ACTIVE',
      collateralCents: '25050',
      creditLimitCents: '25050',
      availableCents: '25050',
    });
    expect(active.card?.token).toMatch(/^card_[A-Za-z0-9_-]{24}$/);
    expect(active.card?.last4).toMatch(/^\d{4}$/);
    expect(active.activatedAt).not.toBeNull();

    // The ledger holds the collateral as a liability, balanced by cash in clearing.
    const postings = await h.db.posting.findMany({
      where: { entry: { accountId: account.id, kind: 'collateral_deposit' } },
      select: { ledgerAccount: true, amountCents: true },
      orderBy: { amountCents: 'asc' },
    });
    expect(postings).toEqual([
      { ledgerAccount: `collateral:${account.id}`, amountCents: -25050n },
      { ledgerAccount: 'cash_clearing', amountCents: 25050n },
    ]);

    // A duplicate webhook is a no-op: the collateral is credited once.
    expect((await webhook(h, res.body.id as string)).status).toBe(204);
    expect((await mine(user)).collateralCents).toBe('25050');
    expect(await trialBalance(h)).toBe(0n);
  });

  it('uses the ratio stored with the deposit, not the policy at confirmation (MO5)', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const created = await deposit(h, user, account.id, '30000');
    await h.db.collateralDeposit.update({
      where: { id: created.id },
      data: { limitRatioBps: 5005 },
    });
    await approve(h, created.id);
    // 30000 × 50.05 % = 15015 exactly; the stored ratio wins over today's 100 %.
    expect(await mine(user)).toMatchObject({ collateralCents: '30000', creditLimitCents: '15015' });
  });

  it('raises the limit of an ACTIVE account with another confirmed deposit (R-55)', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const more = await deposit(h, user, account.id, '30000');
    await approve(h, more.id);
    expect(await mine(user)).toMatchObject({ collateralCents: '50000', creditLimitCents: '50000' });
  });

  it('refuses a forged webhook (401) and an unknown reference (404), changing nothing', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const created = await deposit(h, user, account.id, '20000');
    h.provider.setStatus(created.id, 'SUCCEEDED');
    const body = JSON.stringify({ paymentId: 'pay_x', reference: created.id });
    const forged = await h.http
      .post('/v1/webhooks/payments')
      .set({
        'Content-Type': 'application/json',
        'X-Signature': 'ab'.repeat(32),
        'X-Signature-Timestamp': String(Math.floor(Date.now() / 1000)),
      })
      .send(body);
    expect(forged.status).toBe(401);
    expect(forged.body).toMatchObject({ code: 'signature.invalid' });
    expect(await mine(user)).toMatchObject({ status: 'PENDING_COLLATERAL' });

    const unknown = await signedPost(h, 'provider', '/v1/webhooks/payments', {
      paymentId: 'pay_unknown',
      reference: randomUUID(),
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({ code: 'common.not_found' });
  });

  it('never credits a provider payment whose amount is not ours (MO4 attacker case)', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const created = await deposit(h, user, account.id, '20000');
    h.provider.setStatus(created.id, 'SUCCEEDED');
    h.provider.tamper(created.id, { amountCents: '999999' });
    const res = await webhook(h, created.id);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'payment.not_confirmed' });
    expect(await mine(user)).toMatchObject({ status: 'PENDING_COLLATERAL', collateralCents: '0' });
  });

  it('answers 503 and changes nothing while the provider is down, then settles (MO4)', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const created = await deposit(h, user, account.id, '20000');
    h.provider.setStatus(created.id, 'SUCCEEDED');
    h.provider.down = true;
    try {
      const res = await webhook(h, created.id);
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ code: 'payment.provider_unavailable' });
      expect(await mine(user)).toMatchObject({ status: 'PENDING_COLLATERAL' });
    } finally {
      h.provider.down = false;
    }
    expect((await webhook(h, created.id)).status).toBe(204);
    expect(await mine(user)).toMatchObject({ status: 'ACTIVE' });
  });

  it('resumes the same deposit when the client retries after a provider outage', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const idempotencyKey = key();
    const send = () =>
      h.http
        .post(`/v1/accounts/${account.id}/deposits`)
        .set(user.auth)
        .set(idempotencyKey)
        .send({ amountCents: '20000' });
    h.provider.down = true;
    try {
      const down = await send();
      expect(down.status).toBe(503);
      expect(down.body).toMatchObject({ code: 'payment.provider_unavailable' });
    } finally {
      h.provider.down = false;
    }
    const retry = await send();
    expect(retry.status).toBe(201);
    expect(await h.db.collateralDeposit.count({ where: { accountId: account.id } })).toBe(1);
    const replay = await send();
    expect(replay.body).toEqual(retry.body);

    const reused = await h.http
      .post(`/v1/accounts/${account.id}/deposits`)
      .set(user.auth)
      .set(idempotencyKey)
      .send({ amountCents: '20001' });
    expect(reused.status).toBe(409);
    expect(reused.body).toMatchObject({ code: 'idempotency.key_reused' });
  });
});

describe('ownership (A14)', () => {
  it("answers 404 for another customer's account, on read and on write", async () => {
    const owner = await createUser(h);
    const intruder = await createUser(h);
    const account = await activeAccount(h, owner);
    const base = `/v1/accounts/${account.id}`;
    for (const path of ['activity', 'deposits', 'repayments', 'authorizations']) {
      const own = await h.http.get(`${base}/${path}`).set(owner.auth);
      expect(own.status).toBe(200);
      const res = await h.http.get(`${base}/${path}`).set(intruder.auth);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'common.not_found' });
    }
    const writes = [
      h.http.post(`${base}/deposits`).set(intruder.auth).set(key()).send({ amountCents: '20000' }),
      h.http.post(`${base}/repayments`).set(intruder.auth).set(key()).send({ amountCents: '100' }),
      h.http.post(`${base}/freeze`).set(intruder.auth).set(key()),
      h.http.post(`${base}/close`).set(intruder.auth).set(key()),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'common.not_found' });
    }
    expect(await mine(owner)).toMatchObject({ status: 'ACTIVE', collateralCents: '20000' });
  });
});
