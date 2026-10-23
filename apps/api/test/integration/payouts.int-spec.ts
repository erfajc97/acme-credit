import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MAX_PAYOUT_ATTEMPTS } from '../../src/modules/payouts/helpers/payout-rules';
import { PayoutsService } from '../../src/modules/payouts/payouts.service';
import {
  activeAccount,
  createUser,
  key,
  startHarness,
  trialBalance,
  webhook,
  type Harness,
  type TestUser,
} from './support/harness';

let h: Harness;
let admin: TestUser;
let payouts: PayoutsService;

beforeAll(async () => {
  h = await startHarness();
  admin = await createUser(h, 'admin');
  payouts = h.app.get(PayoutsService);
});

afterEach(() => {
  h.provider.down = false;
  h.provider.payoutStatus = 'SUCCEEDED';
});

afterAll(async () => {
  await h.close();
});

const LATER_MS = 2 * 60 * 60_000;

/** Close an account in good standing: its collateral is owed back through a PENDING payout. */
async function closedWithPayout(depositCents = '20000') {
  const user = await createUser(h);
  const account = await activeAccount(h, user, depositCents);
  const closed = await h.http.post(`/v1/accounts/${account.id}/close`).set(user.auth).set(key());
  expect(closed.status).toBe(200);
  const payout = await h.db.payout.findFirstOrThrow({ where: { accountId: account.id } });
  return { user, account, payout };
}

function paymentsFor(reference: string) {
  return [...h.provider.payments.values()].filter((item) => item.reference === reference);
}

describe('payouts are sent, retried and settled through one path (R-05, MO4, MO5)', () => {
  it('provider down: nothing changes but the note; later the same reference is sent once (provider-down)', async () => {
    const { payout } = await closedWithPayout();
    h.provider.down = true;
    await expect(payouts.sendDue({ now: new Date(), payoutId: payout.id })).resolves.toBe(1);
    const untouched = await h.db.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(untouched).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      providerReference: payout.providerReference,
      providerPaymentId: null,
      lastError: 'provider_unavailable',
    });
    expect(paymentsFor(payout.providerReference)).toHaveLength(0);

    h.provider.down = false;
    // Still inside the claim lease: not due yet.
    await expect(payouts.sendDue({ now: new Date(), payoutId: payout.id })).resolves.toBe(0);
    await payouts.sendDue({ now: new Date(Date.now() + LATER_MS), payoutId: payout.id });
    const sent = await h.db.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(sent).toMatchObject({ status: 'SENT', attempts: 1, lastError: null });
    expect(paymentsFor(payout.providerReference)).toHaveLength(1);
    expect(sent.providerPaymentId).toBe(paymentsFor(payout.providerReference)[0]?.id);
    // Settled: further sweeps never touch it.
    await expect(
      payouts.sendDue({ now: new Date(Date.now() + 2 * LATER_MS), payoutId: payout.id }),
    ).resolves.toBe(0);
    expect(
      await h.db.auditLog.count({ where: { entityId: payout.id, action: 'payout.sent' } }),
    ).toBe(1);
  });

  it('retries a FAILED attempt with a new reference and backoff; after the last one it is FAILED, once', async () => {
    const { payout } = await closedWithPayout();
    h.provider.payoutStatus = 'FAILED';
    const references = new Set<string>();
    let now = Date.now();
    for (let attempt = 1; attempt <= MAX_PAYOUT_ATTEMPTS; attempt += 1) {
      const before = await h.db.payout.findUniqueOrThrow({ where: { id: payout.id } });
      references.add(before.providerReference);
      expect(before).toMatchObject({ status: 'PENDING', attempts: attempt });
      await payouts.sendDue({ now: new Date(now), payoutId: payout.id });
      const after = await h.db.payout.findUniqueOrThrow({ where: { id: payout.id } });
      if (attempt < MAX_PAYOUT_ATTEMPTS) {
        // Backoff: not due again right away.
        expect(after.nextAttemptAt.getTime()).toBeGreaterThan(now);
        expect(await payouts.sendDue({ now: new Date(now), payoutId: payout.id })).toBe(0);
      }
      now += LATER_MS;
    }
    const failed = await h.db.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(failed).toMatchObject({
      status: 'FAILED',
      attempts: MAX_PAYOUT_ATTEMPTS,
      lastError: 'provider_failed',
    });
    expect(failed.failedAt).not.toBeNull();
    // One provider payment per attempt, each under its own reference (MO5).
    expect(references.size).toBe(MAX_PAYOUT_ATTEMPTS);
    for (const reference of references) expect(paymentsFor(reference)).toHaveLength(1);
    const actions = await h.db.auditLog.findMany({
      where: { entityId: payout.id, action: { startsWith: 'payout.' } },
      select: { action: true },
    });
    expect(actions.filter((row) => row.action === 'payout.attempt_failed')).toHaveLength(
      MAX_PAYOUT_ATTEMPTS - 1,
    );
    expect(actions.filter((row) => row.action === 'payout.failed')).toHaveLength(1);
    await expect(
      payouts.sendDue({ now: new Date(now + LATER_MS), payoutId: payout.id }),
    ).resolves.toBe(0);
    expect(await trialBalance(h)).toBe(0n);
  });

  it('N parallel senders of one payout: one provider payment, SENT once (concurrency)', async () => {
    const { payout } = await closedWithPayout();
    const now = new Date();
    const claimed = await Promise.all(
      Array.from({ length: 6 }, () => payouts.sendDue({ now, payoutId: payout.id })),
    );
    expect(claimed.reduce((sum, count) => sum + count, 0)).toBe(1);
    expect(paymentsFor(payout.providerReference)).toHaveLength(1);
    expect(
      await h.db.auditLog.count({ where: { entityId: payout.id, action: 'payout.sent' } }),
    ).toBe(1);
  });

  it('a provider still PENDING is waited on; its webhook settles it through the same path', async () => {
    const { payout } = await closedWithPayout();
    h.provider.payoutStatus = 'PENDING';
    await payouts.sendDue({ now: new Date(), payoutId: payout.id });
    expect(await h.db.payout.findUniqueOrThrow({ where: { id: payout.id } })).toMatchObject({
      status: 'PENDING',
      attempts: 1,
    });
    h.provider.setStatus(payout.providerReference, 'SUCCEEDED');
    const hook = await webhook(h, payout.providerReference);
    expect(hook.status).toBe(204);
    expect(await h.db.payout.findUniqueOrThrow({ where: { id: payout.id } })).toMatchObject({
      status: 'SENT',
      attempts: 1,
    });
    expect(
      await h.db.auditLog.count({ where: { entityId: payout.id, action: 'payout.sent' } }),
    ).toBe(1);
  });
});

describe('GET /v1/admin/payouts and the account detail', () => {
  it('lists payouts newest first, in numbered pages, filtered by status, with the exact keys', async () => {
    const first = await closedWithPayout('20000');
    const second = await closedWithPayout('30000');
    const page = await h.http.get('/v1/admin/payouts?pageSize=1&status=PENDING').set(admin.auth);
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.items[0]).toMatchObject({
      id: second.payout.id,
      accountId: second.account.id,
      amountCents: '30000',
      reason: 'collateral_release',
      status: 'PENDING',
      attempts: 1,
      customer: { id: second.user.id, email: second.user.email },
    });
    expect(Object.keys(page.body.items[0]).sort()).toEqual(
      [
        'accountId',
        'amountCents',
        'attempts',
        'createdAt',
        'customer',
        'failedAt',
        'id',
        'lastError',
        'nextAttemptAt',
        'providerPaymentId',
        'reason',
        'sentAt',
        'status',
      ].sort(),
    );
    const pending = await h.db.payout.count({ where: { status: 'PENDING' } });
    expect(page.body).toMatchObject({ page: 1, pageSize: 1, total: pending, totalPages: pending });
    const next = await h.http
      .get('/v1/admin/payouts?page=2&pageSize=1&status=PENDING')
      .set(admin.auth);
    expect(next.body.items[0]).toMatchObject({ id: first.payout.id });

    // The closed account's activity counts its collateral release too (the fourth source).
    const activity = await h.http
      .get(`/v1/accounts/${first.account.id}/activity`)
      .set(first.user.auth);
    expect(activity.status).toBe(200);
    expect(activity.body.total).toBe(activity.body.items.length);
    expect(activity.body.items.map((item: { type: string }) => item.type)).toContain(
      'collateral_released',
    );

    await payouts.sendDue({ now: new Date(), payoutId: first.payout.id });
    const sent = await h.http.get('/v1/admin/payouts?status=SENT&pageSize=10').set(admin.auth);
    expect(sent.body.items.map((item: { id: string }) => item.id)).toContain(first.payout.id);
    expect(sent.body.items.every((item: { status: string }) => item.status === 'SENT')).toBe(true);
  });

  it('validates the query and is admin-only', async () => {
    const customer = await createUser(h);
    expect((await h.http.get('/v1/admin/payouts')).status).toBe(401);
    expect((await h.http.get('/v1/admin/payouts').set(customer.auth)).status).toBe(403);
    for (const query of [
      'status=pending',
      'pageSize=11',
      'pageSize=0',
      'page=0',
      'cursor=zzz',
      'extra=1',
    ]) {
      const res = await h.http.get(`/v1/admin/payouts?${query}`).set(admin.auth);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'common.validation_failed' });
    }
    expect((await h.http.get('/v1/admin/payouts?page=1&pageSize=10').set(admin.auth)).status).toBe(
      200,
    );
  });

  it('shows the payout state on the admin account detail', async () => {
    const { account, payout } = await closedWithPayout();
    const detail = await h.http.get(`/v1/admin/accounts/${account.id}`).set(admin.auth);
    expect(detail.status).toBe(200);
    expect(detail.body.payouts).toEqual([
      expect.objectContaining({ id: payout.id, status: 'PENDING', amountCents: '20000' }),
    ]);
    expect(detail.body.payouts[0]).not.toHaveProperty('customer');
    const none = await h.http.get(`/v1/admin/accounts/${randomUUID()}`).set(admin.auth);
    expect(none.status).toBe(404);
  });
});
