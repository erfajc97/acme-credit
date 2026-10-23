import type { Account } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthorizationsService } from '../../src/modules/authorizations/authorizations.service';
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

let h: Harness;
let admin: TestUser;

beforeAll(async () => {
  h = await startHarness();
  admin = await createUser(h, 'admin');
});

afterAll(async () => {
  await h.close();
});

const HOUR_MS = 3_600_000;

function capture(authorizationId: string, amountCents: string) {
  return signedPost(
    h,
    'network',
    `/v1/network/authorizations/${authorizationId}/capture`,
    { amountCents },
    { 'Idempotency-Key': randomUUID() },
  );
}

function release(authorizationId: string, headers: Record<string, string> = key()) {
  return h.http
    .post(`/v1/admin/authorizations/${authorizationId}/release`)
    .set(admin.auth)
    .set(headers);
}

async function balances(user: TestUser): Promise<Account> {
  return (await h.http.get('/v1/accounts/me').set(user.auth)).body as Account;
}

async function approvedHold(user: TestUser, amountCents: string) {
  const account = await activeAccount(h, user, '20000');
  const res = await purchase(h, account.card?.token ?? '', amountCents);
  expect(res.body).toMatchObject({ status: 'APPROVED', reversalReason: null });
  return { account, hold: res.body as { id: string; expiresAt: string } };
}

describe('hold expiry (worker sweep)', () => {
  it('records the expiry at approval: HOLD_TTL_HOURS (168 h) after the decision (MO5)', async () => {
    const user = await createUser(h);
    const before = Date.now();
    const { hold } = await approvedHold(user, '1000');
    const expiresAt = new Date(hold.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 168 * HOUR_MS);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 168 * HOUR_MS);
    const declined = await purchase(h, 'card_unknown', '100');
    expect(declined.body).toMatchObject({ status: 'DECLINED', expiresAt: null });
  });

  it('releases an expired hold through the reversal path; a capture afterwards is 409', async () => {
    const user = await createUser(h);
    const { account, hold } = await approvedHold(user, '5000');
    const expiresAt = new Date(hold.expiresAt);
    const holds = h.app.get(AuthorizationsService);

    // One millisecond early: nothing happens.
    await holds.releaseExpiredHolds(new Date(expiresAt.getTime() - 1));
    expect(await h.db.authorization.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({
      status: 'APPROVED',
    });

    expect(await holds.releaseExpiredHolds(expiresAt)).toBeGreaterThanOrEqual(1);
    expect(await h.db.authorization.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({
      status: 'REVERSED',
      reversalReason: 'expired',
    });
    expect(await balances(user)).toMatchObject({ heldCents: '0', availableCents: '20000' });
    const audit = await h.db.auditLog.findFirstOrThrow({
      where: { entityId: hold.id, action: 'authorization.reversed' },
    });
    expect(audit).toMatchObject({
      actorType: 'system',
      data: expect.objectContaining({ reason: 'expired' }),
    });
    expect(
      await h.db.outboxEvent.count({
        where: { type: 'authorization.reversed', payload: { path: ['entityId'], equals: hold.id } },
      }),
    ).toBe(1);

    const late = await capture(hold.id, '5000');
    expect(late.status).toBe(409);
    expect(late.body).toMatchObject({
      code: 'authorization.hold_released',
      details: { reason: 'expired' },
    });
    // The sweep is idempotent: running again changes nothing for this hold.
    await holds.releaseExpiredHolds(new Date(expiresAt.getTime() + HOUR_MS));
    expect(
      await h.db.auditLog.count({ where: { entityId: hold.id, action: 'authorization.reversed' } }),
    ).toBe(1);
    expect((await balances(user)).postedDebtCents).toBe('0');
    expect(account.id).toBeDefined();
    expect(await trialBalance(h)).toBe(0n);
  });

  it('refuses the capture of an expired hold even before the sweep reaches it', async () => {
    const user = await createUser(h);
    const { hold } = await approvedHold(user, '700');
    await h.db.authorization.update({
      where: { id: hold.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const res = await capture(hold.id, '700');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'authorization.hold_released' });
    expect(await balances(user)).toMatchObject({ heldCents: '700', postedDebtCents: '0' });
  });
});

describe('POST /v1/admin/authorizations/:id/release', () => {
  it('releases a live hold as the admin, idempotently; the capture afterwards is 409', async () => {
    const user = await createUser(h);
    const { hold } = await approvedHold(user, '2500');
    const idempotencyKey = key();
    const res = await release(hold.id, idempotencyKey);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: hold.id,
      status: 'REVERSED',
      reversalReason: 'admin_release',
      amountCents: '2500',
    });
    expect(Object.keys(res.body).sort()).toEqual(
      [
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
      ].sort(),
    );
    const replay = await release(hold.id, idempotencyKey);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(res.body);
    expect(await balances(user)).toMatchObject({ heldCents: '0', availableCents: '20000' });
    const audit = await h.db.auditLog.findMany({
      where: { entityId: hold.id, action: 'authorization.reversed' },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorType: 'admin', actorId: admin.id });

    const late = await capture(hold.id, '2500');
    expect(late.status).toBe(409);
    expect(late.body).toMatchObject({
      code: 'authorization.hold_released',
      details: { reason: 'admin_release' },
    });
    const again = await release(hold.id);
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'authorization.not_reversible' });
  });

  it('is admin-only, needs a key, and answers 404 for a missing authorization', async () => {
    const user = await createUser(h);
    const { hold } = await approvedHold(user, '300');
    const path = `/v1/admin/authorizations/${hold.id}/release`;
    expect((await h.http.post(path).set(key())).status).toBe(401);
    const asCustomer = await h.http.post(path).set(user.auth).set(key());
    expect(asCustomer.status).toBe(403);
    expect(asCustomer.body).toMatchObject({ code: 'common.forbidden' });
    const noKey = await h.http.post(path).set(admin.auth);
    expect(noKey.status).toBe(422);
    expect(noKey.body).toMatchObject({ code: 'idempotency.key_required' });
    const missing = await release(randomUUID());
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'common.not_found' });
    const badBody = await h.http.post(path).set(admin.auth).set(key()).send({ reason: 'x' });
    expect(badBody.status).toBe(422);
    expect(badBody.body).toMatchObject({ code: 'common.validation_failed' });
    expect(await balances(user)).toMatchObject({ heldCents: '300' });
  });

  it('capture ∥ release on the same hold: exactly one wins, every time (concurrency)', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const holds: string[] = [];
    for (let n = 0; n < 5; n += 1) {
      const res = await purchase(h, account.card?.token ?? '', '1000');
      holds.push(res.body.id as string);
    }
    const results = await Promise.all(
      holds.map((id) => Promise.all([capture(id, '1000'), release(id)])),
    );
    let captured = 0;
    for (const [captureRes, releaseRes] of results) {
      const winners = [captureRes, releaseRes].filter((res) => res.status < 300);
      expect(winners).toHaveLength(1);
      if (captureRes.status < 300) {
        captured += 1;
        expect(releaseRes.body).toMatchObject({ code: 'authorization.not_reversible' });
      } else {
        expect(captureRes.body).toMatchObject({ code: 'authorization.hold_released' });
      }
    }
    expect(await balances(user)).toMatchObject({
      heldCents: '0',
      postedDebtCents: String(captured * 1000),
    });
    expect(await trialBalance(h)).toBe(0n);
  });
});
