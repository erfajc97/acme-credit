import type { Account } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/core/database/prisma.service';
import { requestHash } from '../../src/core/idempotency/request-hash';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../src/core/payment-provider/payment-provider.port';
import { PendingPaymentsSweeper } from '../../src/modules/payments/jobs/pending-payments.sweeper';
import { PaymentSettlementService } from '../../src/modules/payments/payment-settlement.service';
import {
  activeAccount,
  approve,
  createUser,
  deposit,
  key,
  openAccount,
  purchase,
  signedPost,
  startHarness,
  trialBalance,
  type Harness,
  type TestUser,
} from './support/harness';

let h: Harness;
let admin: TestUser;

beforeAll(async () => {
  h = await startHarness();
  admin = await createUser(h, 'admin');
});

afterEach(() => {
  h.provider.down = false;
});

afterAll(async () => {
  await h.close();
});

async function mine(user: TestUser): Promise<Account> {
  return (await h.http.get('/v1/accounts/me').set(user.auth)).body as Account;
}

describe('idempotency lease (MO2, ADR-0004)', () => {
  /** The row a request leaves behind when it dies after claiming its key (no effect committed). */
  async function crashedClaim(user: TestUser, lockedUntil: Date, body: unknown = {}) {
    const idempotencyKey = randomUUID();
    await h.db.idempotencyKey.create({
      data: {
        scope: user.id,
        key: idempotencyKey,
        requestHash: requestHash({ method: 'POST', path: '/v1/accounts', body }),
        lockedUntil,
      },
    });
    return { 'Idempotency-Key': idempotencyKey };
  }

  it('lets a retry take over a crashed request once its lease lapsed, running the effect once', async () => {
    const user = await createUser(h);
    const headers = await crashedClaim(user, new Date(Date.now() - 1_000));
    const retry = await h.http.post('/v1/accounts').set(user.auth).set(headers);
    expect(retry.status).toBe(201);
    const replay = await h.http.post('/v1/accounts').set(user.auth).set(headers);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(retry.body);
    expect(await h.db.account.count({ where: { customerId: user.id } })).toBe(1);
    expect(
      await h.db.idempotencyKey.findFirstOrThrow({ where: { key: headers['Idempotency-Key'] } }),
    ).toMatchObject({ status: 'COMPLETED', attempt: 2 });
  });

  it('answers 409 in_progress while the lease is live, and runs nothing', async () => {
    const user = await createUser(h);
    const headers = await crashedClaim(user, new Date(Date.now() + 60_000));
    const res = await h.http.post('/v1/accounts').set(user.auth).set(headers);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'idempotency.in_progress' });
    expect(await h.db.account.count({ where: { customerId: user.id } })).toBe(0);
  });

  it('two retries racing for a lapsed key: one takes it over, one effect', async () => {
    const user = await createUser(h);
    const headers = await crashedClaim(user, new Date(Date.now() - 1_000));
    const results = await Promise.all(
      Array.from({ length: 5 }, () => h.http.post('/v1/accounts').set(user.auth).set(headers)),
    );
    const statuses = results.map((res) => res.status);
    expect(statuses).toContain(201);
    for (const res of results.filter((item) => item.status !== 201)) {
      expect(res.body).toMatchObject({ code: 'idempotency.in_progress' });
    }
    expect(await h.db.account.count({ where: { customerId: user.id } })).toBe(1);
  });
});

describe('frozenBy: a customer cannot lift an admin freeze (R-52, attacker case)', () => {
  it('admin freezes with a reason; the customer unfreeze is 409; the admin unfreezes', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user);
    const frozen = await h.http
      .post(`/v1/admin/accounts/${account.id}/freeze`)
      .set(admin.auth)
      .set(key())
      .send({ reason: 'suspected_fraud' });
    expect(frozen.status).toBe(200);
    expect(frozen.body).toMatchObject({ status: 'FROZEN', frozenBy: 'ADMIN' });
    expect(await mine(user)).toMatchObject({ status: 'FROZEN', frozenBy: 'ADMIN' });

    // The exact request of the audit finding: the customer lifts the bank's freeze.
    const attack = await h.http
      .post(`/v1/accounts/${account.id}/unfreeze`)
      .set(user.auth)
      .set(key());
    expect(attack.status).toBe(409);
    expect(attack.body).toMatchObject({ code: 'account.frozen_by_admin' });
    expect(await mine(user)).toMatchObject({ status: 'FROZEN', frozenBy: 'ADMIN' });
    const declined = await purchase(h, account.card?.token ?? '', '100');
    expect(declined.body).toMatchObject({ status: 'DECLINED', declineReason: 'card_frozen' });

    const detail = await h.http.get(`/v1/admin/accounts/${account.id}`).set(admin.auth);
    expect(detail.body).toMatchObject({ frozenBy: 'ADMIN', freezeReason: 'suspected_fraud' });

    const lifted = await h.http
      .post(`/v1/admin/accounts/${account.id}/unfreeze`)
      .set(admin.auth)
      .set(key());
    expect(lifted.status).toBe(200);
    expect(lifted.body).toMatchObject({ status: 'ACTIVE', frozenBy: null });
    const row = await h.db.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(row).toMatchObject({ frozenBy: null, freezeReason: null, frozenAt: null });
  });

  it("an admin takes over the customer's freeze; the customer's own freeze is theirs to lift", async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user);
    const act = (who: TestUser, action: string) =>
      h.http
        .post(
          who === admin
            ? `/v1/admin/accounts/${account.id}/${action}`
            : `/v1/accounts/${account.id}/${action}`,
        )
        .set(who.auth)
        .set(key());
    expect((await act(user, 'freeze')).body).toMatchObject({ frozenBy: 'CUSTOMER' });
    const stored = await h.db.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(stored).toMatchObject({ frozenBy: 'CUSTOMER', freezeReason: 'customer_request' });
    expect(stored.frozenAt).not.toBeNull();
    expect((await act(user, 'unfreeze')).body).toMatchObject({ status: 'ACTIVE', frozenBy: null });

    expect((await act(user, 'freeze')).status).toBe(200);
    const takeover = await act(admin, 'freeze');
    expect(takeover.status).toBe(200);
    expect(takeover.body).toMatchObject({ frozenBy: 'ADMIN' });
    expect((await act(user, 'unfreeze')).body).toMatchObject({ code: 'account.frozen_by_admin' });
    expect((await act(admin, 'freeze')).body).toMatchObject({ code: 'account.not_active' });
  });

  it('validates the admin freeze body: no body and {} are fine, an unknown reason is 422', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user);
    const path = `/v1/admin/accounts/${account.id}/freeze`;
    const bad = await h.http
      .post(path)
      .set(admin.auth)
      .set(key())
      .send({ reason: 'customer_request' });
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ code: 'common.validation_failed' });
    const empty = await h.http.post(path).set(admin.auth).set(key());
    expect(empty.status).toBe(200);
    const detail = await h.http.get(`/v1/admin/accounts/${account.id}`).set(admin.auth);
    expect(detail.body).toMatchObject({ frozenBy: 'ADMIN', freezeReason: 'admin_review' });
  });
});

describe('collateral cap per account: USD 10,000.00 confirmed + pending (decision G11)', () => {
  const requestDeposit = (user: TestUser, accountId: string, amountCents: string) =>
    h.http
      .post(`/v1/accounts/${accountId}/deposits`)
      .set(user.auth)
      .set(key())
      .send({ amountCents });

  it('passes at exactly the cap and refuses one cent more (boundary pair)', async () => {
    const atCap = await createUser(h);
    const a = await activeAccount(h, atCap, '979999');
    expect((await requestDeposit(atCap, a.id, '20001')).status).toBe(201);

    const overCap = await createUser(h);
    const b = await activeAccount(h, overCap, '980000');
    const res = await requestDeposit(overCap, b.id, '20001');
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'payment.deposit_cap_exceeded',
      details: { maxCents: '1000000', currentCents: '980000' },
    });
    expect(await h.db.collateralDeposit.count({ where: { accountId: b.id } })).toBe(1);
  });

  it('counts pending deposits until they expire', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const first = await deposit(h, user, account.id, '1000000');
    const blocked = await requestDeposit(user, account.id, '20000');
    expect(blocked.body).toMatchObject({
      code: 'payment.deposit_cap_exceeded',
      details: { currentCents: '1000000' },
    });
    await h.db.collateralDeposit.update({
      where: { id: first.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect((await requestDeposit(user, account.id, '20000')).status).toBe(201);
  });

  it('N parallel deposits: only what fits under the cap passes (concurrency)', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => requestDeposit(user, account.id, '200000')),
    );
    expect(results.filter((res) => res.status === 201)).toHaveLength(5);
    const refused = results.filter((res) => res.status !== 201);
    expect(refused).toHaveLength(1);
    expect(refused[0]?.body).toMatchObject({ code: 'payment.deposit_cap_exceeded' });
    const sum = await h.db.collateralDeposit.aggregate({
      where: { accountId: account.id },
      _sum: { amountCents: true },
    });
    expect(sum._sum.amountCents).toBe(1_000_000n);
  });
});

describe('PENDING repayments expire and stop blocking (R-04, MO4)', () => {
  function sweeper() {
    return new PendingPaymentsSweeper(
      h.app.get(PrismaService),
      h.app.get(PaymentSettlementService),
      h.app.get<PaymentProvider>(PAYMENT_PROVIDER),
    );
  }

  it('records the expiry at request time (PENDING_PAYMENT_TTL_MINUTES = 30)', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const before = Date.now();
    const res = await h.http
      .post(`/v1/accounts/${account.id}/deposits`)
      .set(user.auth)
      .set(key())
      .send({ amountCents: '20000' });
    const expiresAt = new Date(res.body.expiresAt as string).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 30 * 60_000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
  });

  it('unblocks after expiry, expires only what the provider confirms unpaid, settles a late approval', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const auth = await purchase(h, account.card?.token ?? '', '5000');
    await signedPost(
      h,
      'network',
      `/v1/network/authorizations/${auth.body.id as string}/capture`,
      { amountCents: '5000' },
      { 'Idempotency-Key': randomUUID() },
    );
    const repay = () =>
      h.http
        .post(`/v1/accounts/${account.id}/repayments`)
        .set(user.auth)
        .set(key())
        .send({ amountCents: '5000' });
    const abandoned = await repay();
    expect(abandoned.status).toBe(201);
    expect((await repay()).body).toMatchObject({ code: 'repayment.exceeds_debt' });

    // 30 minutes later the customer never approved it at the bank: it no longer blocks.
    const expiresAt = new Date(Date.now() - 1_000);
    await h.db.repayment.update({ where: { id: abandoned.body.id }, data: { expiresAt } });
    const retried = await repay();
    expect(retried.status).toBe(201);

    // Provider down: uncertain is not "no" — the row stays PENDING (provider-down).
    h.provider.down = true;
    await sweeper().sweepOnce(new Date(Date.now() + 61_000));
    expect(
      await h.db.repayment.findUniqueOrThrow({ where: { id: abandoned.body.id } }),
    ).toMatchObject({ status: 'PENDING' });
    h.provider.down = false;

    // The provider says it is still unpaid: EXPIRED, audited once.
    await sweeper().sweepOnce(new Date(Date.now() + 61_000));
    expect(
      await h.db.repayment.findUniqueOrThrow({ where: { id: abandoned.body.id } }),
    ).toMatchObject({ status: 'EXPIRED' });
    await sweeper().sweepOnce(new Date(Date.now() + 61_000));
    expect(
      await h.db.auditLog.count({
        where: { entityId: abandoned.body.id, action: 'repayment.expired' },
      }),
    ).toBe(1);
    const listed = await h.http.get(`/v1/accounts/${account.id}/repayments`).set(user.auth);
    expect(listed.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: abandoned.body.id, status: 'EXPIRED' }),
      ]),
    );

    // A late approval of the expired one still settles through the same path.
    expect((await approve(h, abandoned.body.id as string)).status).toBe(204);
    expect(await mine(user)).toMatchObject({ postedDebtCents: '0', availableCents: '20000' });
    // The second payment then finds no debt: it is refunded in full.
    expect((await approve(h, retried.body.id as string)).status).toBe(204);
    expect(
      await h.db.repayment.findUniqueOrThrow({ where: { id: retried.body.id } }),
    ).toMatchObject({ status: 'CONFIRMED', appliedCents: 0n });
    expect(
      await h.db.payout.findFirst({
        where: { accountId: account.id, reason: 'repayment_refund', amountCents: 5_000n },
      }),
    ).not.toBeNull();
    expect(await trialBalance(h)).toBe(0n);
  });
});
