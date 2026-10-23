import type { Account } from '@acme/contracts';
import { signRequest } from '@acme/nest-core';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activeAccount,
  createUser,
  deposit,
  openAccount,
  startHarness,
  testEnv,
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

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** One signed call exactly as an attacker would have captured it off the wire. */
function capturedCall(input: {
  caller: 'network' | 'provider';
  path: string;
  body: object;
  at?: number;
}) {
  const rawBody = JSON.stringify(input.body);
  const idempotencyKey = randomUUID();
  const secret = testEnv(
    input.caller === 'network' ? 'NETWORK_SIGNING_SECRET' : 'PROVIDER_SIGNING_SECRET',
  );
  const headers = {
    ...signRequest(
      { secret, method: 'POST', path: input.path, idempotencyKey, rawBody },
      input.at ?? nowSeconds(),
    ),
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  };
  return {
    headers,
    send: (overrides: Record<string, string> = {}) =>
      h.http
        .post(input.path)
        .set({ ...headers, ...overrides })
        .send(rawBody),
  };
}

async function mine(user: TestUser): Promise<Account> {
  return (await h.http.get('/v1/accounts/me').set(user.auth)).body as Account;
}

/**
 * P3 triple. The Idempotency-Key decides whether the core applies a call again, so it is part of
 * the signed string: a captured purchase resent under a fresh key must not place a second hold.
 */
describe('signed calls: another key, a stale signature and a replay (P3)', () => {
  it('network → core: other key 401, 301 s late 401, same key replays; one hold', async () => {
    const user = await createUser(h);
    const account = await activeAccount(h, user, '20000');
    const purchase = {
      cardToken: account.card?.token ?? '',
      amountCents: '1000',
      merchant: { name: 'Corner Grocery', mcc: '5411' },
    };
    const path = '/v1/network/authorizations';
    const captured = capturedCall({ caller: 'network', path, body: purchase });

    const first = await captured.send();
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: 'APPROVED' });

    const otherKey = await captured.send({ 'Idempotency-Key': randomUUID() });
    expect(otherKey.status).toBe(401);
    expect(otherKey.body).toMatchObject({
      code: 'signature.invalid',
      details: { reason: 'mismatch' },
    });

    const stale = capturedCall({ caller: 'network', path, body: purchase, at: nowSeconds() - 301 });
    const late = await stale.send();
    expect(late.status).toBe(401);
    expect(late.body).toMatchObject({ code: 'signature.invalid', details: { reason: 'stale' } });

    const replayed = await captured.send();
    expect(replayed.status).toBe(201);
    expect(replayed.body).toEqual(first.body);

    expect(await mine(user)).toMatchObject({ heldCents: '1000', availableCents: '19000' });
    expect(await h.db.authorization.count({ where: { accountId: account.id } })).toBe(1);
  });

  it('provider → core webhook: the same capture under another key is 401 and credits nothing', async () => {
    const user = await createUser(h);
    const account = await openAccount(h, user);
    const created = await deposit(h, user, account.id, '20000');
    h.provider.setStatus(created.id, 'SUCCEEDED');
    const payment = h.provider.byReference(created.id);
    const captured = capturedCall({
      caller: 'provider',
      path: '/v1/webhooks/payments',
      body: { paymentId: payment.id, reference: created.id },
    });

    const swapped = await captured.send({ 'Idempotency-Key': randomUUID() });
    expect(swapped.status).toBe(401);
    expect(swapped.body).toMatchObject({ code: 'signature.invalid' });
    expect(await mine(user)).toMatchObject({ status: 'PENDING_COLLATERAL', collateralCents: '0' });

    expect((await captured.send()).status).toBe(204);
    expect((await captured.send()).status).toBe(204);
    expect(await mine(user)).toMatchObject({ status: 'ACTIVE', collateralCents: '20000' });
  });
});
