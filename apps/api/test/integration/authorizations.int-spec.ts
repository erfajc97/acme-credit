import type { Account } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activeAccount,
  createUser,
  key,
  purchase,
  signedPost,
  startHarness,
  trialBalance,
  type Harness,
  type TestUser,
} from './support/harness';

const AUTHORIZATION_KEYS = [
  'accountId',
  'amountCents',
  'capturedCents',
  'createdAt',
  'declineReason',
  'expiresAt',
  'id',
  'items',
  'merchantMcc',
  'merchantName',
  'reversalReason',
  'status',
  'updatedAt',
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

function capture(authorizationId: string, amountCents: string, idempotencyKey = randomUUID()) {
  return signedPost(
    h,
    'network',
    `/v1/network/authorizations/${authorizationId}/capture`,
    { amountCents },
    { 'Idempotency-Key': idempotencyKey },
  );
}

function reversal(authorizationId: string) {
  return signedPost(
    h,
    'network',
    `/v1/network/authorizations/${authorizationId}/reversal`,
    {},
    { 'Idempotency-Key': randomUUID() },
  );
}

describe('POST /v1/network/authorizations (R-03)', () => {
  it('declines one cent over the available credit and approves exactly the available amount', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const token = account.card?.token ?? '';

    const over = await purchase(h, token, '20001');
    expect(over.status).toBe(201);
    expect(over.body).toMatchObject({ status: 'DECLINED', declineReason: 'insufficient_funds' });

    const exact = await purchase(h, token, '20000');
    expect(exact.status).toBe(201);
    expect(Object.keys(exact.body).sort()).toEqual(AUTHORIZATION_KEYS);
    expect(exact.body).toMatchObject({
      status: 'APPROVED',
      declineReason: null,
      accountId: account.id,
      amountCents: '20000',
      capturedCents: '0',
      merchantName: 'Corner Grocery',
      merchantMcc: '5411',
    });
    expect(await mine(user)).toMatchObject({ heldCents: '20000', availableCents: '0' });
  });

  it('approves exactly as many of 50 parallel purchases as fit, never over the limit (ADR-0003)', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const token = account.card?.token ?? '';
    // 1500 fits 13 times in 20000 (19500), leaving 500: exactly 13 approvals.
    const results = await Promise.all(Array.from({ length: 50 }, () => purchase(h, token, '1500')));
    expect(results.map((res) => res.status)).toEqual(Array(50).fill(201));
    const approved = results.filter((res) => res.body.status === 'APPROVED');
    const declined = results.filter((res) => res.body.status === 'DECLINED');
    expect(approved).toHaveLength(13);
    expect(declined).toHaveLength(37);
    expect(declined.every((res) => res.body.declineReason === 'insufficient_funds')).toBe(true);
    expect(await mine(user)).toMatchObject({ heldCents: '19500', availableCents: '500' });
    expect(await h.db.authorization.count({ where: { accountId: account.id } })).toBe(50);
  });

  it('declines with the reason for unknown, frozen and not-active cards', async () => {
    const unknown = await purchase(h, `card_${'x'.repeat(24)}`, '100');
    expect(unknown.status).toBe(201);
    expect(unknown.body).toMatchObject({
      status: 'DECLINED',
      declineReason: 'invalid_card',
      accountId: null,
    });

    const user = await createUser(h);
    const account = await activeAccount(h, user);
    const token = account.card?.token ?? '';
    await h.http.post(`/v1/accounts/${account.id}/freeze`).set(user.auth).set(key());
    expect((await purchase(h, token, '100')).body).toMatchObject({
      status: 'DECLINED',
      declineReason: 'card_frozen',
    });
    await h.http.post(`/v1/accounts/${account.id}/unfreeze`).set(user.auth).set(key());
    expect((await purchase(h, token, '100')).body).toMatchObject({ status: 'APPROVED' });
  });

  it('answers a network retry with the same decision and a single hold; another payload is 409', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user);
    const token = account.card?.token ?? '';
    const idempotencyKey = randomUUID();
    const first = await purchase(h, token, '700', idempotencyKey);
    const retries = await Promise.all(
      [1, 2, 3].map(() => purchase(h, token, '700', idempotencyKey)),
    );
    for (const retry of retries) {
      // A retry racing the first attempt may see it in flight; once done it replays.
      if (retry.status === 409)
        expect(retry.body).toMatchObject({ code: 'idempotency.in_progress' });
      else expect(retry.body).toEqual(first.body);
    }
    expect(await mine(user)).toMatchObject({ heldCents: '700' });
    const reused = await purchase(h, token, '701', idempotencyKey);
    expect(reused.status).toBe(409);
    expect(reused.body).toMatchObject({ code: 'idempotency.key_reused' });
  });

  it('refuses an unsigned or forged call and a missing key', async () => {
    const body = { cardToken: 'card_x', amountCents: '100', merchant: { name: 'X', mcc: '5411' } };
    const unsigned = await h.http.post('/v1/network/authorizations').set(key()).send(body);
    expect(unsigned.status).toBe(401);
    expect(unsigned.body).toMatchObject({ code: 'signature.invalid' });
    const noKey = await signedPost(h, 'network', '/v1/network/authorizations', body);
    expect(noKey.status).toBe(422);
    expect(noKey.body).toMatchObject({ code: 'idempotency.key_required' });
  });
});

const LINES = [
  { sku: 'TAQ-PASTOR', name: 'Tacos al pastor', quantity: 2, unitCents: '350' },
  { sku: 'TAQ-AGUA', name: 'Agua fresca', quantity: 1, unitCents: '300' },
];

function storePurchase(cardToken: string, amountCents: string, idempotencyKey = randomUUID()) {
  return signedPost(
    h,
    'network',
    '/v1/network/authorizations',
    { cardToken, amountCents, merchant: { name: 'Taquería El Sol', mcc: '5812' }, items: LINES },
    { 'Idempotency-Key': idempotencyKey },
  );
}

describe('store purchases with order lines', () => {
  it('accepts lines totalling the amount and refuses one cent more or less before writing anything', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const token = account.card?.token ?? '';

    const mismatch = await storePurchase(token, '1001');
    expect(mismatch.status).toBe(422);
    expect(mismatch.body).toMatchObject({
      code: 'common.validation_failed',
      details: { reason: 'items_total_mismatch' },
    });
    expect(await h.db.authorization.count({ where: { accountId: account.id } })).toBe(0);
    expect(await mine(user)).toMatchObject({ heldCents: '0' });

    // One cent under the lines would undercharge the store: refused the same way, no hold.
    const under = await storePurchase(token, '999');
    expect(under.status).toBe(422);
    expect(under.body).toMatchObject({
      code: 'common.validation_failed',
      details: { reason: 'items_total_mismatch' },
    });
    expect(await h.db.authorization.count({ where: { accountId: account.id } })).toBe(0);
    expect(await mine(user)).toMatchObject({ heldCents: '0', availableCents: '20000' });

    const idempotencyKey = randomUUID();
    const exact = await storePurchase(token, '1000', idempotencyKey);
    expect(exact.status).toBe(201);
    expect(Object.keys(exact.body).sort()).toEqual(AUTHORIZATION_KEYS);
    expect(exact.body).toMatchObject({ status: 'APPROVED', amountCents: '1000', items: LINES });
    expect(await mine(user)).toMatchObject({ heldCents: '1000' });

    // The network retry replays the same decision, lines included, with a single hold.
    const replay = await storePurchase(token, '1000', idempotencyKey);
    expect(replay.body).toEqual(exact.body);
    expect(await mine(user)).toMatchObject({ heldCents: '1000' });

    const listed = await h.http.get(`/v1/accounts/${account.id}/authorizations`).set(user.auth);
    expect(listed.body.items).toMatchObject([{ id: exact.body.id, items: LINES }]);
  });

  it('stores the lines on a decline too, and plain purchases carry no lines', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const token = account.card?.token ?? '';
    await h.http.post(`/v1/accounts/${account.id}/freeze`).set(user.auth).set(key());
    const declined = await storePurchase(token, '1000');
    expect(declined.body).toMatchObject({
      status: 'DECLINED',
      declineReason: 'card_frozen',
      items: LINES,
    });
    const unknown = await storePurchase(`card_${'z'.repeat(24)}`, '1000');
    expect(unknown.body).toMatchObject({ declineReason: 'invalid_card', items: LINES });
    const stored = await h.db.authorization.findUniqueOrThrow({
      where: { id: unknown.body.id as string },
      select: { items: true },
    });
    expect(stored.items).toEqual(LINES);

    await h.http.post(`/v1/accounts/${account.id}/unfreeze`).set(user.auth).set(key());
    expect((await purchase(h, token, '100')).body).toMatchObject({ status: 'APPROVED', items: [] });
  });

  it('describes a store purchase in the activity as merchant plus item count', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const token = account.card?.token ?? '';
    await purchase(h, token, '100');
    await storePurchase(token, '1000');
    const res = await h.http.get(`/v1/accounts/${account.id}/activity?pageSize=2`).set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.items).toMatchObject([
      { type: 'purchase', amountCents: '1000', description: 'Taquería El Sol · 3 items' },
      { type: 'purchase', amountCents: '100', description: 'Corner Grocery' },
    ]);
  });
});

describe('capture and reversal', () => {
  it('captures up to the authorized amount, moving the hold to posted debt with a ledger entry', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const auth = await purchase(h, account.card?.token ?? '', '5000');
    const id = auth.body.id as string;

    const tooMuch = await capture(id, '5001');
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body).toMatchObject({ code: 'authorization.capture_exceeds_hold' });

    const captureKey = randomUUID();
    const partial = await capture(id, '4000', captureKey);
    expect(partial.status).toBe(201);
    expect(partial.body).toMatchObject({
      status: 'CAPTURED',
      capturedCents: '4000',
      amountCents: '5000',
    });
    expect(await mine(user)).toMatchObject({
      heldCents: '0',
      postedDebtCents: '4000',
      availableCents: '16000',
    });

    // The network retries captures with the same key: same answer, no second debt.
    expect((await capture(id, '4000', captureKey)).body).toEqual(partial.body);
    const again = await capture(id, '4000');
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'authorization.not_capturable' });
    expect(await mine(user)).toMatchObject({ postedDebtCents: '4000' });

    const postings = await h.db.posting.findMany({
      where: { entry: { accountId: account.id, kind: 'purchase_capture' } },
      select: { ledgerAccount: true, amountCents: true },
      orderBy: { amountCents: 'asc' },
    });
    expect(postings).toEqual([
      { ledgerAccount: 'merchant_settlement', amountCents: -4000n },
      { ledgerAccount: `receivable:${account.id}`, amountCents: 4000n },
    ]);
    expect(await trialBalance(h)).toBe(0n);
  });

  it('reverses a live hold once; a reversed or declined authorization cannot move again', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const auth = await purchase(h, account.card?.token ?? '', '3000');
    const id = auth.body.id as string;
    const reversed = await reversal(id);
    expect(reversed.status).toBe(201);
    expect(reversed.body).toMatchObject({ status: 'REVERSED' });
    expect(await mine(user)).toMatchObject({ heldCents: '0', availableCents: '20000' });

    const twice = await reversal(id);
    expect(twice.status).toBe(409);
    expect(twice.body).toMatchObject({ code: 'authorization.not_reversible' });
    expect((await capture(id, '3000')).body).toMatchObject({
      code: 'authorization.not_capturable',
    });

    const declined = await purchase(h, `card_${'y'.repeat(24)}`, '100');
    expect((await capture(declined.body.id as string, '100')).body).toMatchObject({
      code: 'authorization.not_capturable',
    });
    const missing = await reversal(randomUUID());
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'common.not_found' });
  });

  it('lists the account authorizations newest first for its owner', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    await purchase(h, account.card?.token ?? '', '100');
    await purchase(h, account.card?.token ?? '', '200');
    const res = await h.http.get(`/v1/accounts/${account.id}/authorizations`).set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { amountCents: string }) => item.amountCents)).toEqual([
      '200',
      '100',
    ]);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 2, totalPages: 1 });
  });
});
