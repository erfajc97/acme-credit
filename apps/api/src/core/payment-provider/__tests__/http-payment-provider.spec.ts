import { verifySignature } from '@acme/nest-core';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env';
import { HttpPaymentProvider, PROVIDER_TIMEOUT_MS } from '../http-payment-provider';

const SECRET = 'p'.repeat(40);
const NOW_MS = Date.UTC(2026, 9, 21, 12, 0, 0);
const env = { PROVIDER_API_URL: 'http://provider.test:3001', PROVIDER_API_SECRET: SECRET } as Env;
const PAYMENT = {
  id: 'pay_1',
  reference: 'ref-1',
  amountCents: '20000',
  purpose: 'deposit',
  status: 'PENDING',
  approveUrl: 'http://provider.test/pay/pay_1',
  createdAt: '2026-10-21T12:00:00.000Z',
  settledAt: null,
};

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

function provider(fetchFn: ReturnType<typeof vi.fn>) {
  return new HttpPaymentProvider(env, fetchFn as unknown as typeof fetch, () => NOW_MS);
}

describe('HttpPaymentProvider (A9)', () => {
  it('signs the exact path and body with a 5 s timeout, and parses the payment', async () => {
    const fetchFn = respond(201, PAYMENT);
    const input = { reference: 'ref-1', amountCents: '20000', purpose: 'deposit' as const };
    await expect(provider(fetchFn).createPayment(input)).resolves.toEqual(PAYMENT);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url.href).toBe('http://provider.test:3001/v1/provider/payments');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(input));
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(PROVIDER_TIMEOUT_MS).toBe(5_000);
    expect(
      verifySignature({
        secret: SECRET,
        method: 'POST',
        path: '/v1/provider/payments',
        // The core sends no Idempotency-Key here (the reference is the key): an empty one.
        idempotencyKey: '',
        rawBody: JSON.stringify(input),
        signature: init.headers['X-Signature'],
        timestamp: init.headers['X-Signature-Timestamp'],
        nowSeconds: NOW_MS / 1000,
        maxSkewSeconds: 300,
      }),
    ).toBe('valid');
  });

  it('reads a payment by id with an empty signed body', async () => {
    const fetchFn = respond(200, PAYMENT);
    await expect(provider(fetchFn).getPayment('pay 1')).resolves.toEqual(PAYMENT);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/provider/payments/pay%201');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('maps a timeout, a 5xx and a malformed answer to 503 provider_unavailable (uncertain, not failed)', async () => {
    const timeout = vi.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    await expect(provider(timeout).getPayment('pay_1')).rejects.toMatchObject({
      code: 'payment.provider_unavailable',
      details: { reason: 'TimeoutError' },
    });
    await expect(provider(respond(502, { code: 'x' })).getPayment('pay_1')).rejects.toMatchObject({
      code: 'payment.provider_unavailable',
      status: 503,
    });
    await expect(provider(respond(200, { id: 'pay_1' })).getPayment('pay_1')).rejects.toMatchObject(
      {
        code: 'payment.provider_unavailable',
      },
    );
    const notJson = vi.fn(async () => new Response('<html>', { status: 200 }));
    await expect(provider(notJson).getPayment('pay_1')).rejects.toMatchObject({
      code: 'payment.provider_unavailable',
    });
    const rejectsString = vi.fn(async () => {
      throw 'socket hang up';
    });
    await expect(provider(rejectsString).getPayment('pay_1')).rejects.toMatchObject({
      details: { reason: 'unknown' },
    });
  });

  it('maps a 4xx (unknown payment, refused reference) to a final payment.not_confirmed', async () => {
    await expect(
      provider(respond(404, { code: 'common.not_found' })).getPayment('x'),
    ).rejects.toMatchObject({
      code: 'payment.not_confirmed',
      details: { status: 404 },
    });
    await expect(provider(respond(499, {})).getPayment('x')).rejects.toMatchObject({
      code: 'payment.not_confirmed',
    });
    await expect(provider(respond(500, {})).getPayment('x')).rejects.toMatchObject({
      code: 'payment.provider_unavailable',
    });
  });
});
