import { verifySignature } from '@acme/nest-core';
import { describe, expect, it, vi } from 'vitest';
import { HttpCoreClient, type HttpCoreClientConfig } from '../http-core-client';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const NOW_SECONDS = NOW.getTime() / 1000;
const NETWORK_SECRET = 'network-secret-0123456789abcdef0123';
const PROVIDER_SECRET = 'provider-secret-0123456789abcdef012';
const KEY = '0b7a4c2e-1f3d-4a5b-8c6d-7e8f9a0b1c2d';
const AUTH_ID = '6d1f8a2b-3c4d-4e5f-9a0b-1c2d3e4f5a6b';

const AUTHORIZATION = {
  id: AUTH_ID,
  accountId: '7e2a9b3c-4d5e-4f6a-8b7c-2d3e4f5a6b7c',
  amountCents: '12550',
  capturedCents: '0',
  status: 'APPROVED',
  declineReason: null,
  merchantName: 'Corner Grocery',
  merchantMcc: '5411',
  items: [],
  expiresAt: '2026-10-28T12:00:00.000Z',
  reversalReason: null,
  createdAt: '2026-10-21T12:00:00.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
};

const PURCHASE = {
  cardToken: 'tok_card_1',
  amountCents: '12550',
  merchant: { name: 'Corner Grocery', mcc: '5411' },
};

type Reply = { status: number; body?: unknown } | Error;

/** A fetch double that records each request and answers from a script (one reply per call). */
function scriptedFetch(replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn((url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const reply = replies[calls.length - 1] ?? { status: 500 };
    if (reply instanceof Error) return Promise.reject(reply);
    // A 204 may not carry a body at all (the Response constructor throws on '').
    const text = reply.body === undefined ? null : JSON.stringify(reply.body);
    return Promise.resolve(new Response(text, { status: reply.status }));
  });
  return { fetch, calls };
}

function client(replies: Reply[], overrides: Partial<HttpCoreClientConfig> = {}) {
  const { fetch, calls } = scriptedFetch(replies);
  const sleep = vi.fn(() => Promise.resolve());
  const logger = { warn: vi.fn(), error: vi.fn() };
  const core = new HttpCoreClient({
    baseUrl: 'http://core.test:3000',
    networkSecret: NETWORK_SECRET,
    providerSecret: PROVIDER_SECRET,
    clock: { now: () => NOW },
    sleep,
    fetch: fetch as unknown as typeof globalThis.fetch,
    timeoutMs: 5_000,
    backoff: { baseDelayMs: 200, maxDelayMs: 2_000 },
    logger,
    ...overrides,
  });
  return { core, calls, sleep, logger };
}

type Call = { url: string; init: RequestInit };

function nth(calls: Call[], index: number): Call {
  const call = calls[index];
  if (!call) throw new Error(`no call #${index}`);
  return call;
}

const header = (init: RequestInit, name: string) =>
  new Headers(init.headers).get(name) ?? undefined;

function signatureOf(
  call: { url: string; init: RequestInit },
  secret: string,
  idempotencyKey = header(call.init, 'Idempotency-Key') ?? '',
) {
  return verifySignature({
    secret,
    method: String(call.init.method),
    path: new URL(call.url).pathname,
    idempotencyKey,
    rawBody: String(call.init.body),
    signature: header(call.init, 'X-Signature'),
    timestamp: header(call.init, 'X-Signature-Timestamp'),
    nowSeconds: NOW_SECONDS,
    maxSkewSeconds: 300,
  });
}

describe('HttpCoreClient.authorize', () => {
  it('posts the purchase signed with the network secret over the exact path and body (P3)', async () => {
    const { core, calls } = client([{ status: 201, body: AUTHORIZATION }]);
    const result = await core.authorize(PURCHASE, { idempotencyKey: KEY, retries: 3 });

    expect(result).toEqual({ kind: 'ok', value: AUTHORIZATION });
    const [call] = calls;
    expect(call?.url).toBe('http://core.test:3000/v1/network/authorizations');
    expect(call?.init.method).toBe('POST');
    expect(JSON.parse(String(call?.init.body))).toEqual(PURCHASE);
    expect(header(nth(calls, 0).init, 'Idempotency-Key')).toBe(KEY);
    expect(header(nth(calls, 0).init, 'Content-Type')).toBe('application/json');
    expect(header(nth(calls, 0).init, 'X-Signature-Timestamp')).toBe(String(NOW_SECONDS));
    expect(signatureOf(nth(calls, 0), NETWORK_SECRET)).toBe('valid');
    expect(signatureOf(nth(calls, 0), PROVIDER_SECRET)).toBe('mismatch');
    // The key is signed too: the core refuses this request resent under another key (P3).
    expect(signatureOf(nth(calls, 0), NETWORK_SECRET, AUTH_ID)).toBe('mismatch');
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries a network error, a timeout and a 5xx with the SAME key, then succeeds', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const { core, calls, sleep } = client([
      new TypeError('fetch failed'),
      timeout,
      { status: 503, body: { code: 'common.internal' } },
      { status: 201, body: AUTHORIZATION },
    ]);
    const result = await core.authorize(PURCHASE, { idempotencyKey: KEY, retries: 3 });

    expect(result.kind).toBe('ok');
    expect(calls).toHaveLength(4);
    expect(calls.map((call) => header(call.init, 'Idempotency-Key'))).toEqual([KEY, KEY, KEY, KEY]);
    expect(sleep.mock.calls.map((args: unknown[]) => args[0])).toEqual([200, 400, 800]);
  });

  it('answers unavailable after the last retry fails (never "declined")', async () => {
    const { core, calls, logger } = client([{ status: 502 }, { status: 502 }]);
    const result = await core.authorize(PURCHASE, { idempotencyKey: KEY, retries: 1 });
    expect(result).toEqual({ kind: 'unavailable' });
    expect(calls).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('retries a 429 and a 409 idempotency.in_progress: the core is still working on the key', async () => {
    const { core, calls } = client([
      { status: 429, body: { code: 'common.rate_limited' } },
      { status: 409, body: { code: 'idempotency.in_progress' } },
      { status: 201, body: AUTHORIZATION },
    ]);
    expect((await core.authorize(PURCHASE, { idempotencyKey: KEY, retries: 3 })).kind).toBe('ok');
    expect(calls).toHaveLength(3);
  });

  it('treats any other 4xx as final, with the catalog code of the envelope', async () => {
    const { core, calls } = client([{ status: 409, body: { code: 'idempotency.key_reused' } }]);
    expect(await core.authorize(PURCHASE, { idempotencyKey: KEY, retries: 3 })).toEqual({
      kind: 'rejected',
      status: 409,
      code: 'idempotency.key_reused',
    });
    expect(calls).toHaveLength(1);
  });

  it('keeps a 4xx whose body is not a catalog envelope as rejected without a code', async () => {
    const { core } = client([{ status: 404, body: { code: 'not.ours' } }]);
    expect(await core.authorize(PURCHASE, { idempotencyKey: KEY, retries: 0 })).toEqual({
      kind: 'rejected',
      status: 404,
      code: null,
    });
  });

  it('answers unavailable when the core answers 2xx outside the contract', async () => {
    const { core, logger } = client([{ status: 201, body: { id: 'x' } }]);
    expect(await core.authorize(PURCHASE, { idempotencyKey: KEY, retries: 3 })).toEqual({
      kind: 'unavailable',
    });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('HttpCoreClient capture, reversal and webhook', () => {
  it('captures the authorization at its own path, signed with the network secret', async () => {
    const { core, calls } = client([{ status: 201, body: { anything: true } }]);
    const result = await core.capture(
      AUTH_ID,
      { amountCents: '12550' },
      { idempotencyKey: KEY, retries: 5 },
    );
    expect(result).toEqual({ kind: 'ok', value: null });
    expect(calls[0]?.url).toBe(
      `http://core.test:3000/v1/network/authorizations/${AUTH_ID}/capture`,
    );
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ amountCents: '12550' });
    expect(signatureOf(nth(calls, 0), NETWORK_SECRET)).toBe('valid');
  });

  it('reverses with an empty JSON object body, signed with the network secret', async () => {
    const { core, calls } = client([{ status: 201 }]);
    expect(await core.reverse(AUTH_ID, { idempotencyKey: KEY, retries: 3 })).toEqual({
      kind: 'ok',
      value: null,
    });
    expect(calls[0]?.url).toBe(
      `http://core.test:3000/v1/network/authorizations/${AUTH_ID}/reversal`,
    );
    expect(calls[0]?.init.body).toBe('{}');
    expect(signatureOf(nth(calls, 0), NETWORK_SECRET)).toBe('valid');
  });

  it('sends the payment webhook signed with the PROVIDER secret, not the network one', async () => {
    const { core, calls } = client([{ status: 204 }]);
    const body = { paymentId: 'pay-1', reference: 'dep-1' };
    expect((await core.notifyPayment(body, { idempotencyKey: KEY, retries: 5 })).kind).toBe('ok');
    expect(calls[0]?.url).toBe('http://core.test:3000/v1/webhooks/payments');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(body);
    expect(signatureOf(nth(calls, 0), PROVIDER_SECRET)).toBe('valid');
    expect(signatureOf(nth(calls, 0), NETWORK_SECRET)).toBe('mismatch');
  });

  it('stops retrying when the caller aborts (shutdown) and reports unavailable', async () => {
    const controller = new AbortController();
    const { core, calls } = client([{ status: 503 }, { status: 503 }], {
      sleep: vi.fn(() => {
        controller.abort();
        return Promise.resolve();
      }),
    });
    const result = await core.notifyPayment(
      { paymentId: 'pay-1', reference: 'dep-1' },
      { idempotencyKey: KEY, retries: 5, signal: controller.signal },
    );
    expect(result).toEqual({ kind: 'unavailable' });
    expect(calls).toHaveLength(1);
  });
});
