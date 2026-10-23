import type { Account } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activeAccount,
  approve,
  createUser,
  key,
  purchase,
  signedPost,
  startHarness,
  trialBalance,
  type Harness,
  type TestUser,
} from './support/harness';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.close();
});

async function capturePurchase(cardToken: string, amountCents: string) {
  const auth = await purchase(h, cardToken, amountCents);
  expect(auth.body).toMatchObject({ status: 'APPROVED' });
  const captured = await signedPost(
    h,
    'network',
    `/v1/network/authorizations/${auth.body.id as string}/capture`,
    { amountCents },
    { 'Idempotency-Key': randomUUID() },
  );
  expect(captured.status).toBe(201);
}

async function mine(user: TestUser): Promise<Account> {
  return (await h.http.get('/v1/accounts/me').set(user.auth)).body as Account;
}

describe('repayments (R-04)', () => {
  it('restores available credit only after the provider confirms, never above the debt', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const repay = (amountCents: string) =>
      h.http
        .post(`/v1/accounts/${account.id}/repayments`)
        .set(user.auth)
        .set(key())
        .send({ amountCents });

    const nothing = await repay('100');
    expect(nothing.status).toBe(409);
    expect(nothing.body).toMatchObject({ code: 'repayment.no_debt' });

    await capturePurchase(account.card?.token ?? '', '5000');
    expect(await mine(user)).toMatchObject({ postedDebtCents: '5000', availableCents: '15000' });

    const tooMuch = await repay('5001');
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body).toMatchObject({ code: 'repayment.exceeds_debt' });
    const created = await repay('5000');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'PENDING', amountCents: '5000' });
    expect(created.body).not.toHaveProperty('limitRatioBps');

    // In flight: a second repayment cannot overpay together with the first.
    const overlapping = await repay('1');
    expect(overlapping.body).toMatchObject({ code: 'repayment.exceeds_debt' });
    expect(await mine(user)).toMatchObject({ availableCents: '15000' });

    expect((await approve(h, created.body.id as string)).status).toBe(204);
    expect(await mine(user)).toMatchObject({ postedDebtCents: '0', availableCents: '20000' });
    expect(await trialBalance(h)).toBe(0n);
  });
});

describe('freeze, unfreeze and close (R-05, R-52)', () => {
  it('freezes and unfreezes once each; repeating says why', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user);
    const act = (action: string) =>
      h.http.post(`/v1/accounts/${account.id}/${action}`).set(user.auth).set(key());
    expect((await act('freeze')).body).toMatchObject({ status: 'FROZEN' });
    expect((await act('freeze')).body).toMatchObject({ code: 'account.not_active' });
    expect((await act('unfreeze')).body).toMatchObject({ status: 'ACTIVE' });
    const again = await act('unfreeze');
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'account.not_frozen' });
  });

  it('refuses to close with purchases on hold', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user);
    expect((await purchase(h, account.card?.token ?? '', '100')).body).toMatchObject({
      status: 'APPROVED',
    });
    const res = await h.http.post(`/v1/accounts/${account.id}/close`).set(user.auth).set(key());
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'account.pending_holds' });
  });

  it('releases the whole collateral when closed in good standing, through a payout', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const idempotencyKey = key();
    const res = await h.http
      .post(`/v1/accounts/${account.id}/close`)
      .set(user.auth)
      .set(idempotencyKey);
    expect(res.status).toBe(200);
    expect(res.body.settlement).toEqual({
      collateralCents: '20000',
      appliedToDebtCents: '0',
      releasedCents: '20000',
    });
    expect(res.body.account).toMatchObject({ status: 'CLOSED', collateralCents: '0' });
    const replay = await h.http
      .post(`/v1/accounts/${account.id}/close`)
      .set(user.auth)
      .set(idempotencyKey);
    expect(replay.body).toEqual(res.body);

    const payouts = await h.db.payout.findMany({ where: { accountId: account.id } });
    expect(payouts).toMatchObject([
      { amountCents: 20000n, status: 'PENDING', reason: 'collateral_release' },
    ]);
    const event = await h.db.outboxEvent.findFirst({
      where: { type: 'payout.requested', payload: { path: ['entityId'], equals: payouts[0]?.id } },
    });
    expect(event).not.toBeNull();
    expect(await trialBalance(h)).toBe(0n);

    const closedAgain = await h.http
      .post(`/v1/accounts/${account.id}/close`)
      .set(user.auth)
      .set(key());
    expect(closedAgain.body).toMatchObject({ code: 'account.closed' });
  });

  it('applies the collateral to the debt first and releases the rest', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    await capturePurchase(account.card?.token ?? '', '7550');
    const res = await h.http.post(`/v1/accounts/${account.id}/close`).set(user.auth).set(key());
    expect(res.status).toBe(200);
    expect(res.body.settlement).toEqual({
      collateralCents: '20000',
      appliedToDebtCents: '7550',
      releasedCents: '12450',
    });
    expect(res.body.account).toMatchObject({ status: 'CLOSED', postedDebtCents: '0' });
    const audit = await h.db.auditLog.findFirst({
      where: { entityId: account.id, action: 'account.closed' },
    });
    expect(audit?.actorType).toBe('customer');
    expect(await trialBalance(h)).toBe(0n);

    // A closed card is declined with its reason.
    const declined = await purchase(h, account.card?.token ?? '', '100');
    expect(declined.body).toMatchObject({
      status: 'DECLINED',
      declineReason: 'account_not_active',
    });
  });
});

describe('activity', () => {
  it('lists deposits, purchases and repayments newest first, page by page', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user);
    await capturePurchase(account.card?.token ?? '', '1200');
    const first = await h.http.get(`/v1/accounts/${account.id}/activity?pageSize=1`).set(user.auth);
    expect(first.status).toBe(200);
    expect(first.body.items).toMatchObject([
      { type: 'purchase', status: 'CAPTURED', amountCents: '1200' },
    ]);
    expect(first.body).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    const second = await h.http
      .get(`/v1/accounts/${account.id}/activity?page=2&pageSize=1`)
      .set(user.auth);
    expect(second.body.items).toMatchObject([
      { type: 'deposit', status: 'CONFIRMED', amountCents: '20000' },
    ]);
    expect(second.body).toMatchObject({ page: 2, total: 2, totalPages: 2 });

    const badPage = await h.http.get(`/v1/accounts/${account.id}/activity?page=0`).set(user.auth);
    expect(badPage.status).toBe(422);
    expect(badPage.body).toMatchObject({ code: 'common.validation_failed' });
  });
});
