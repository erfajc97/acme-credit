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
const CART = {
  cardToken: 'tok_card_1',
  merchant: 'electro',
  items: [
    { sku: 'ELC-EARBUDS', quantity: 1 },
    { sku: 'ELC-CHARGER', quantity: 2 },
  ],
};
/** 7999 + 2 × 3499, priced from the catalog by the network. */
const TOTAL = '14997';
const LINES = [
  { sku: 'ELC-EARBUDS', name: 'Wireless earbuds', quantity: 1, unitCents: '7999' },
  { sku: 'ELC-CHARGER', name: '65 W fast charger', quantity: 2, unitCents: '3499' },
];

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

const checkout = (body: object, key: string | null = randomUUID()) => {
  const req = request(app.getHttpServer())
    .post('/v1/checkout')
    .set('Content-Type', 'application/json');
  return (key === null ? req : req.set('Idempotency-Key', key)).send(body);
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('POST /v1/checkout', () => {
  it('prices the cart server-side and forwards a signed, keyed authorization with its lines', async () => {
    const key = randomUUID();
    const res = await checkout(CART, key);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual([
      'authorizationId',
      'availableCents',
      'declineReason',
      'lines',
      'merchantName',
      'status',
      'totalCents',
    ]);
    expect(res.body).toMatchObject({
      status: 'APPROVED',
      declineReason: null,
      availableCents: null,
      merchantName: 'Electro Hub',
      totalCents: TOTAL,
      lines: LINES,
    });

    const [forwarded] = core.to('/v1/network/authorizations');
    expect(forwarded?.headers['idempotency-key']).toBe(key);
    expect(JSON.parse(forwarded?.rawBody ?? '')).toEqual({
      cardToken: 'tok_card_1',
      amountCents: TOTAL,
      merchant: { name: 'Electro Hub', mcc: '5732' },
      items: LINES,
    });
    expect(forwarded && signatureCheck(forwarded, env.NETWORK_SIGNING_SECRET)).toBe('valid');
  });

  it('captures the total once after CAPTURE_DELAY_MS; a decline is never captured', async () => {
    const res = await checkout(CART);
    const capturePath = `/v1/network/authorizations/${res.body.authorizationId}/capture`;
    expect(core.to(capturePath)).toHaveLength(0);
    await waitFor(() => core.to(capturePath).length > 0);
    expect(JSON.parse(core.to(capturePath)[0]?.rawBody ?? '')).toEqual({ amountCents: TOTAL });

    const declined = await checkout({ ...CART, cardToken: 'tok_declined' });
    expect(declined.body).toMatchObject({
      status: 'DECLINED',
      declineReason: 'insufficient_funds',
    });
    await pause(CAPTURE_DELAY_MS + 200);
    const declinedPath = `/v1/network/authorizations/${declined.body.authorizationId}`;
    expect(core.under(declinedPath)).toHaveLength(0);
  });

  it('is voided through /v1/purchases/:id/void before its capture', async () => {
    const res = await checkout(CART);
    const id = res.body.authorizationId as string;
    const voided = await request(app.getHttpServer())
      .post(`/v1/purchases/${id}/void`)
      .set('Idempotency-Key', randomUUID())
      .send({ cardToken: CART.cardToken });
    expect(voided.status).toBe(200);
    expect(voided.body).toMatchObject({ authorizationId: id, status: 'REVERSED' });
    expect(core.to(`/v1/network/authorizations/${id}/reversal`)).toHaveLength(1);
    await pause(CAPTURE_DELAY_MS + 200);
    expect(core.to(`/v1/network/authorizations/${id}/capture`)).toHaveLength(0);
  });

  it('replays the same key and cart (one core call); another cart → 409 key_reused', async () => {
    const key = randomUUID();
    const first = await checkout(CART, key);
    const again = await checkout(CART, key);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(core.to('/v1/network/authorizations')).toHaveLength(1);

    const reused = await checkout({ ...CART, items: [{ sku: 'ELC-EARBUDS', quantity: 2 }] }, key);
    expect(reused.status).toBe(409);
    expect(reused.body).toMatchObject({ code: 'idempotency.key_reused' });
  });

  it('binds the key to the quantities: the same SKU, 1 then 2 → 409 key_reused, one core call', async () => {
    const key = randomUUID();
    const one = await checkout({ ...CART, items: [{ sku: 'ELC-EARBUDS', quantity: 1 }] }, key);
    expect(one.status).toBe(201);

    const two = await checkout({ ...CART, items: [{ sku: 'ELC-EARBUDS', quantity: 2 }] }, key);
    expect(two.status).toBe(409);
    expect(two.body).toMatchObject({ code: 'idempotency.key_reused' });
    expect(core.to('/v1/network/authorizations')).toHaveLength(1);
  });

  it('requires the Idempotency-Key header (a valid cart without it → 422 key_required)', async () => {
    for (const key of [null, 'not-a-uuid']) {
      const res = await checkout(CART, key);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'idempotency.key_required' });
    }
    expect(core.requests).toHaveLength(0);
  });

  it('refuses an unknown SKU or a SKU of another merchant with 422 unknown_sku, before the core', async () => {
    for (const sku of ['NOPE-1', 'MKT-COFFEE']) {
      const res = await checkout({ ...CART, items: [{ sku, quantity: 1 }] });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'common.validation_failed',
        details: { reason: 'unknown_sku' },
      });
    }
    expect(core.requests).toHaveLength(0);
  });

  it('validates the body: quantity 20 passes; 0, 21, a price, an unknown merchant, no items fail', async () => {
    const one = (quantity: number) => ({ ...CART, items: [{ sku: 'ELC-EARBUDS', quantity }] });
    expect((await checkout(one(20))).status).toBe(201);
    for (const body of [
      one(0),
      one(21),
      { ...CART, items: [{ sku: 'ELC-EARBUDS', quantity: 1, unitCents: '1' }] },
      { ...CART, amountCents: '1' },
      { ...CART, merchant: 'nope' },
      { ...CART, items: [] },
    ]) {
      const res = await checkout(body);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'common.validation_failed' });
    }
  });

  it('answers 503 payment.provider_unavailable when the core stays down', async () => {
    core.respondWith(() => ({ status: 503 }));
    const res = await checkout(CART);
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'payment.provider_unavailable' });
  });
});
