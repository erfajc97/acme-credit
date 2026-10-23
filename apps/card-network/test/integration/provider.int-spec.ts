import { formatCents } from '@acme/contracts';
import { createApp, signRequest } from '@acme/nest-core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import type { Env } from '../../src/core/config/env';
import { ENV } from '../../src/core/config/env.provider';
import { CoreStub, signatureCheck, waitFor } from './support/core-stub';

const core = new CoreStub();
let app: INestApplication;
let env: Env;
let references = 0;

beforeAll(async () => {
  vi.stubEnv('CORE_API_URL', await core.start());
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

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** A call from the core, signed with the provider API secret (P3). */
function signedByCore(method: 'GET' | 'POST', path: string, body?: object, secret?: string) {
  const rawBody = body === undefined ? '' : JSON.stringify(body);
  const headers = signRequest(
    { secret: secret ?? env.PROVIDER_API_SECRET, method, path, idempotencyKey: '', rawBody },
    nowSeconds(),
  );
  const server = app.getHttpServer();
  if (method === 'GET') return request(server).get(path).set(headers);
  return request(server)
    .post(path)
    .set(headers)
    .set('Content-Type', 'application/json')
    .send(rawBody);
}

const newDeposit = () => ({
  reference: `dep-${++references}`,
  amountCents: '25000',
  purpose: 'deposit' as const,
});

describe('provider API (signed by the core)', () => {
  it('creates a PENDING payment with the exact contract shape and our approve URL', async () => {
    const res = await signedByCore('POST', '/v1/provider/payments', newDeposit());
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual([
      'amountCents',
      'approveUrl',
      'createdAt',
      'id',
      'purpose',
      'reference',
      'settledAt',
      'status',
    ]);
    expect(res.body).toMatchObject({ status: 'PENDING', settledAt: null, amountCents: '25000' });
    expect(res.body.approveUrl).toBe(`${env.PUBLIC_URL}/provider/pay/${res.body.id}`);
  });

  it('is idempotent by reference; the same reference with another amount → 409', async () => {
    const deposit = newDeposit();
    const first = await signedByCore('POST', '/v1/provider/payments', deposit);
    const again = await signedByCore('POST', '/v1/provider/payments', deposit);
    expect(again.body).toEqual(first.body);

    const changed = await signedByCore('POST', '/v1/provider/payments', {
      ...deposit,
      amountCents: '25001',
    });
    expect(changed.status).toBe(409);
    expect(changed.body).toMatchObject({ code: 'idempotency.key_reused' });
  });

  it('rejects an unsigned, a forged and a tampered call with 401 signature.invalid', async () => {
    const body = newDeposit();
    const unsigned = await request(app.getHttpServer()).post('/v1/provider/payments').send(body);
    const forged = await signedByCore('POST', '/v1/provider/payments', body, 'x'.repeat(32));
    const headers = signRequest(
      {
        secret: env.PROVIDER_API_SECRET,
        method: 'POST',
        path: '/v1/provider/payments',
        idempotencyKey: '',
        rawBody: JSON.stringify(body),
      },
      nowSeconds(),
    );
    const tampered = await request(app.getHttpServer())
      .post('/v1/provider/payments')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ...body, amountCents: '99999' }));
    for (const res of [unsigned, forged, tampered]) {
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'signature.invalid' });
    }
  });

  it('validates the body after the signature (a signed bad amount → 422)', async () => {
    const res = await signedByCore('POST', '/v1/provider/payments', {
      ...newDeposit(),
      amountCents: '25.00',
    });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'common.validation_failed' });
  });

  it('reads a payment back, and answers 404 common.not_found for an unknown one', async () => {
    const created = await signedByCore('POST', '/v1/provider/payments', newDeposit());
    const read = await signedByCore('GET', `/v1/provider/payments/${created.body.id}`);
    expect(read.status).toBe(200);
    expect(read.body).toEqual(created.body);

    const unknown = await signedByCore('GET', '/v1/provider/payments/unknown-id');
    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({ code: 'common.not_found' });
  });

  it('settles a payout at once and sends its signed webhook', async () => {
    const res = await signedByCore('POST', '/v1/provider/payments', {
      reference: `out-${++references}`,
      amountCents: '5000',
      purpose: 'payout',
    });
    expect(res.body).toMatchObject({ status: 'SUCCEEDED' });
    await waitFor(() => core.to('/v1/webhooks/payments').length > 0);
    const [webhook] = core.to('/v1/webhooks/payments');
    expect(JSON.parse(webhook?.rawBody ?? '')).toEqual({
      paymentId: res.body.id,
      reference: res.body.reference,
    });
    expect(webhook && signatureCheck(webhook, env.PROVIDER_SIGNING_SECRET)).toBe('valid');
  });
});

describe('hosted pay page (public)', () => {
  it('renders the amount and purpose with Approve / Decline, under a strict CSP', async () => {
    const created = await signedByCore('POST', '/v1/provider/payments', newDeposit());
    const res = await request(app.getHttpServer()).get(`/provider/pay/${created.body.id}?lang=en`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.vary).toContain('Accept-Language');
    expect(res.text).toContain('<html lang="en-US">');
    expect(res.text).toContain(formatCents('25000'));
    expect(res.text).toContain('Security deposit to Acme Credit');
    expect(res.text).toContain(`action="/provider/pay/${created.body.id}/approve?lang=en"`);
    expect(res.text).toContain(`href="${env.WEB_URL}/app"`);
  });

  it('speaks Spanish by default and English when Accept-Language prefers it; ?lang wins', async () => {
    const created = await signedByCore('POST', '/v1/provider/payments', newDeposit());
    const path = `/provider/pay/${created.body.id}`;
    const server = app.getHttpServer();

    const plain = await request(server).get(path);
    expect(plain.text).toContain('<html lang="es-MX">');
    expect(plain.text).toContain('Depósito de garantía a Acme Credit');
    expect(plain.text).toContain(formatCents('25000', 'es-MX'));

    const english = await request(server).get(path).set('Accept-Language', 'en-US,es;q=0.5');
    expect(english.text).toContain('<html lang="en-US">');

    const forced = await request(server).get(`${path}?lang=es`).set('Accept-Language', 'en-US');
    expect(forced.text).toContain('<html lang="es-MX">');

    const stray = await request(server).get(`${path}?lang=fr`);
    expect(stray.status).toBe(200);
    expect(stray.text).toContain('<html lang="es-MX">');
  });

  it('answers a 404 page for an unknown payment, in the asked language', async () => {
    const res = await request(app.getHttpServer()).get('/provider/pay/unknown-id');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Pago no encontrado');
    const en = await request(app.getHttpServer()).get('/provider/pay/unknown-id?lang=en');
    expect(en.text).toContain('Payment not found');
  });

  it('serves its stylesheet as CSS', async () => {
    const res = await request(app.getHttpServer()).get('/provider/assets/pay.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
  });

  it('approve → 303 back to the page, SUCCEEDED, one signed webhook; a later decline changes nothing', async () => {
    const created = await signedByCore('POST', '/v1/provider/payments', newDeposit());
    const id = created.body.id as string;

    const approved = await request(app.getHttpServer())
      .post(`/provider/pay/${id}/approve`)
      .type('form')
      .send('');
    expect(approved.status).toBe(303);
    expect(approved.headers.location).toBe(`/provider/pay/${id}`);

    const read = await signedByCore('GET', `/v1/provider/payments/${id}`);
    expect(read.body).toMatchObject({ status: 'SUCCEEDED', settledAt: expect.any(String) });
    await waitFor(() => core.to('/v1/webhooks/payments').length > 0);
    const [webhook] = core.to('/v1/webhooks/payments');
    expect(JSON.parse(webhook?.rawBody ?? '')).toEqual({
      paymentId: id,
      reference: created.body.reference,
    });
    expect(webhook && signatureCheck(webhook, env.PROVIDER_SIGNING_SECRET)).toBe('valid');
    expect(webhook && signatureCheck(webhook, env.NETWORK_SIGNING_SECRET)).toBe('mismatch');

    const declined = await request(app.getHttpServer()).post(`/provider/pay/${id}/decline`).send();
    expect(declined.status).toBe(303);
    expect((await signedByCore('GET', `/v1/provider/payments/${id}`)).body.status).toBe(
      'SUCCEEDED',
    );
    const page = await request(app.getHttpServer()).get(`/provider/pay/${id}`);
    expect(page.text).toContain('Pago aprobado');
    expect(page.text).not.toContain('<form');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(core.to('/v1/webhooks/payments')).toHaveLength(1);
  });

  it('decline → FAILED; the webhook is retried with the same key until the core accepts it', async () => {
    let failures = 1;
    core.respondWith((req) =>
      req.path === '/v1/webhooks/payments' && failures-- > 0 ? { status: 500 } : undefined,
    );
    const created = await signedByCore('POST', '/v1/provider/payments', newDeposit());
    const id = created.body.id as string;

    await request(app.getHttpServer()).post(`/provider/pay/${id}/decline`).send();
    expect((await signedByCore('GET', `/v1/provider/payments/${id}`)).body.status).toBe('FAILED');
    await waitFor(() => core.to('/v1/webhooks/payments').length === 2);
    const keys = core.to('/v1/webhooks/payments').map((req) => req.headers['idempotency-key']);
    expect(keys[0]).toBe(keys[1]);
  });

  it('keeps the page language through the approve redirect', async () => {
    const created = await signedByCore('POST', '/v1/provider/payments', newDeposit());
    const id = created.body.id as string;
    const approved = await request(app.getHttpServer())
      .post(`/provider/pay/${id}/approve?lang=en`)
      .type('form')
      .send('');
    expect(approved.status).toBe(303);
    expect(approved.headers.location).toBe(`/provider/pay/${id}?lang=en`);
    const page = await request(app.getHttpServer()).get(approved.headers.location as string);
    expect(page.text).toContain('Payment approved');
    expect(page.text).toContain('<span class="chip chip-approved">Approved</span>');
  });

  it('approving an unknown payment answers 404', async () => {
    const res = await request(app.getHttpServer()).post('/provider/pay/unknown-id/approve').send();
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'common.not_found' });
  });
});
