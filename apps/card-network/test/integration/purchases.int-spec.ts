import { randomUUID } from 'node:crypto';
import { createApp } from '@acme/nest-core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import type { Env } from '../../src/core/config/env';
import { ENV } from '../../src/core/config/env.provider';
import { CoreStub, signatureCheck, waitFor } from './support/core-stub';

const CAPTURE_DELAY_MS = 400;
const PURCHASE = {
  cardToken: 'tok_card_1',
  amountCents: '12550',
  merchant: { name: 'Corner Grocery', mcc: '5411' },
};

const core = new CoreStub();
let app: INestApplication;
let env: Env;

beforeAll(async () => {
  vi.stubEnv('CORE_API_URL', await core.start());
  vi.stubEnv('CAPTURE_DELAY_MS', String(CAPTURE_DELAY_MS));
  app = await createApp(AppModule, { CORS_ORIGINS: [] }, { logger: false });
  await app.init();
  env = app.get<Env>(ENV);
});

afterEach(() => core.reset());

afterAll(async () => {
  await app.close();
  await core.stop();
  vi.unstubAllEnvs();
});

const buy = (body: object, key: string | null = randomUUID()) => {
  const req = request(app.getHttpServer())
    .post('/v1/purchases')
    .set('Content-Type', 'application/json');
  return (key === null ? req : req.set('Idempotency-Key', key)).send(body);
};
const voidPurchase = (
  authorizationId: string,
  key = randomUUID(),
  body: object = { cardToken: PURCHASE.cardToken },
) =>
  request(app.getHttpServer())
    .post(`/v1/purchases/${authorizationId}/void`)
    .set('Idempotency-Key', key)
    .send(body);

describe('POST /v1/purchases', () => {
  it('forwards a signed, keyed authorization and answers the exact purchase result', async () => {
    const key = randomUUID();
    const res = await buy(PURCHASE, key);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual([
      'authorizationId',
      'availableCents',
      'declineReason',
      'status',
    ]);
    expect(res.body).toMatchObject({
      status: 'APPROVED',
      declineReason: null,
      availableCents: null,
    });

    const [forwarded] = core.to('/v1/network/authorizations');
    expect(forwarded?.headers['idempotency-key']).toBe(key);
    expect(JSON.parse(forwarded?.rawBody ?? '')).toEqual(PURCHASE);
    expect(forwarded && signatureCheck(forwarded, env.NETWORK_SIGNING_SECRET)).toBe('valid');
  });

  it('captures the authorized amount once, after CAPTURE_DELAY_MS, signed', async () => {
    const res = await buy(PURCHASE);
    const capturePath = `/v1/network/authorizations/${res.body.authorizationId}/capture`;
    expect(core.to(capturePath)).toHaveLength(0);

    await waitFor(() => core.to(capturePath).length > 0);
    const [capture] = core.to(capturePath);
    expect(JSON.parse(capture?.rawBody ?? '')).toEqual({ amountCents: '12550' });
    expect(capture && signatureCheck(capture, env.NETWORK_SIGNING_SECRET)).toBe('valid');
    expect(String(capture?.headers['idempotency-key'])).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers a decline with its reason and never captures it', async () => {
    const res = await buy({ ...PURCHASE, cardToken: 'tok_declined' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'DECLINED', declineReason: 'insufficient_funds' });
    await new Promise((resolve) => setTimeout(resolve, CAPTURE_DELAY_MS + 200));
    expect(core.under(`/v1/network/authorizations/${res.body.authorizationId}`)).toHaveLength(0);
  });

  it('replays the same key and body (one call to the core); another body → 409 key_reused', async () => {
    const key = randomUUID();
    const first = await buy(PURCHASE, key);
    const again = await buy(PURCHASE, key);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(core.to('/v1/network/authorizations')).toHaveLength(1);

    const reused = await buy({ ...PURCHASE, amountCents: '12551' }, key);
    expect(reused.status).toBe(409);
    expect(reused.body).toMatchObject({ code: 'idempotency.key_reused' });
  });

  it('requires the Idempotency-Key header (a valid body without it → 422 key_required)', async () => {
    for (const key of [null, 'not-a-uuid']) {
      const res = await buy(PURCHASE, key);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'idempotency.key_required' });
    }
    expect(core.requests).toHaveLength(0);
  });

  it('validates the body: amount 1 passes, 0 and a number fail; unknown keys fail', async () => {
    expect((await buy({ ...PURCHASE, amountCents: '1' })).status).toBe(201);
    for (const body of [
      { ...PURCHASE, amountCents: '0' },
      { ...PURCHASE, amountCents: 12550 },
      { ...PURCHASE, merchant: { name: 'Corner Grocery', mcc: '541' } },
      { ...PURCHASE, extra: true },
    ]) {
      const res = await buy(body);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'common.validation_failed' });
    }
  });

  it('retries 5xx with the SAME key until the core answers', async () => {
    let failures = 2;
    core.respondWith(() => (failures-- > 0 ? { status: 503 } : undefined));
    const key = randomUUID();
    const res = await buy(PURCHASE, key);

    expect(res.status).toBe(201);
    const attempts = core.to('/v1/network/authorizations');
    expect(attempts).toHaveLength(3);
    expect(attempts.map((attempt) => attempt.headers['idempotency-key'])).toEqual([key, key, key]);
  });

  it('answers 503 payment.provider_unavailable when the core stays down; the same key works later', async () => {
    core.respondWith(() => ({ status: 503 }));
    const key = randomUUID();
    const down = await buy(PURCHASE, key);
    expect(down.status).toBe(503);
    expect(down.body).toMatchObject({ code: 'payment.provider_unavailable' });
    expect(core.to('/v1/network/authorizations')).toHaveLength(4);

    core.reset();
    const later = await buy(PURCHASE, key);
    expect(later.status).toBe(201);
  });
});

describe('POST /v1/purchases/:authorizationId/void', () => {
  it('cancels the pending capture and reverses at the core, signed', async () => {
    const purchase = await buy(PURCHASE);
    const id = purchase.body.authorizationId as string;

    const res = await voidPurchase(id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authorizationId: id,
      status: 'REVERSED',
      declineReason: null,
      availableCents: null,
    });
    const [reversal] = core.to(`/v1/network/authorizations/${id}/reversal`);
    expect(reversal && signatureCheck(reversal, env.NETWORK_SIGNING_SECRET)).toBe('valid');

    await new Promise((resolve) => setTimeout(resolve, CAPTURE_DELAY_MS + 200));
    expect(core.to(`/v1/network/authorizations/${id}/capture`)).toHaveLength(0);
  });

  it('refuses with 409 authorization.not_reversible once captured', async () => {
    const purchase = await buy(PURCHASE);
    const id = purchase.body.authorizationId as string;
    await waitFor(() => core.to(`/v1/network/authorizations/${id}/capture`).length > 0);

    const res = await voidPurchase(id);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'authorization.not_reversible' });
  });

  it('answers 404 to another card that learned the id (attacker), leaving the hold to be captured', async () => {
    const purchase = await buy(PURCHASE);
    const id = purchase.body.authorizationId as string;

    const res = await voidPurchase(id, randomUUID(), { cardToken: 'tok_attacker' });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'common.not_found' });
    expect(core.to(`/v1/network/authorizations/${id}/reversal`)).toHaveLength(0);
    // The owner's purchase goes on: captured on schedule, as if nobody had asked.
    await waitFor(() => core.to(`/v1/network/authorizations/${id}/capture`).length > 0);
  });

  it('refuses a void without the card (base body passes first) with 422', async () => {
    const purchase = await buy(PURCHASE);
    const id = purchase.body.authorizationId as string;
    for (const body of [{}, { cardToken: '' }, { cardToken: PURCHASE.cardToken, extra: 1 }]) {
      const res = await voidPurchase(id, randomUUID(), body);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'common.validation_failed' });
    }
    expect((await voidPurchase(id)).status).toBe(200);
  });

  it('answers 404 for an unknown authorization, 422 for a malformed id or a missing key', async () => {
    const unknown = await voidPurchase(randomUUID());
    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({ code: 'common.not_found' });

    const malformed = await voidPurchase('nope');
    expect(malformed.status).toBe(422);
    expect(malformed.body).toMatchObject({ code: 'common.validation_failed' });

    const noKey = await request(app.getHttpServer())
      .post(`/v1/purchases/${randomUUID()}/void`)
      .send({ cardToken: PURCHASE.cardToken });
    expect(noKey.body).toMatchObject({ code: 'idempotency.key_required' });
  });
});
