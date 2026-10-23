import { randomUUID } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { verifySignature } from '@acme/nest-core';

export interface RecordedRequest {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  rawBody: string;
}

export interface StubReply {
  status: number;
  body?: unknown;
}

type Responder = (request: RecordedRequest) => StubReply | undefined;

/**
 * A stand-in for the lending core on a real local port, so the app's HTTP adapter, signing,
 * timeouts and retries run for real (no patched fetch). Authorizations are idempotent by key,
 * like the core's (ADR-0004); a test can script replies with `respondWith`.
 */
export class CoreStub {
  readonly requests: RecordedRequest[] = [];
  private responder: Responder = () => undefined;
  private readonly authorizationsByKey = new Map<string, Record<string, unknown>>();
  private readonly server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const recorded: RecordedRequest = {
        method: req.method ?? '',
        path: req.url ?? '',
        headers: req.headers,
        rawBody: Buffer.concat(chunks).toString('utf8'),
      };
      this.requests.push(recorded);
      const reply = this.responder(recorded) ?? this.defaultReply(recorded);
      res.statusCode = reply.status;
      if (reply.body === undefined) {
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(reply.body));
    });
  });

  async start(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  /** Scripts replies until `reset()`; returning undefined falls back to the default core. */
  respondWith(responder: Responder): void {
    this.responder = responder;
  }

  reset(): void {
    this.requests.length = 0;
    this.responder = () => undefined;
  }

  /** Requests to exactly this path. */
  to(path: string): RecordedRequest[] {
    return this.requests.filter((request) => request.path === path);
  }

  /** Requests to this path or below it. */
  under(pathPrefix: string): RecordedRequest[] {
    return this.requests.filter((request) => request.path.startsWith(pathPrefix));
  }

  private defaultReply(request: RecordedRequest): StubReply {
    if (request.path === '/v1/network/authorizations') return this.authorize(request);
    if (request.path === '/v1/webhooks/payments') return { status: 204 };
    return { status: 201, body: {} };
  }

  private authorize(request: RecordedRequest): StubReply {
    const key = String(request.headers['idempotency-key']);
    const stored = this.authorizationsByKey.get(key);
    if (stored) return { status: 201, body: stored };
    const body = JSON.parse(request.rawBody) as {
      cardToken: string;
      amountCents: string;
      merchant: { name: string; mcc: string };
      items?: unknown[];
    };
    const declined = body.cardToken === 'tok_declined';
    const now = new Date().toISOString();
    const authorization = {
      id: randomUUID(),
      accountId: declined ? null : randomUUID(),
      amountCents: body.amountCents,
      capturedCents: '0',
      status: declined ? 'DECLINED' : 'APPROVED',
      declineReason: declined ? 'insufficient_funds' : null,
      merchantName: body.merchant.name,
      merchantMcc: body.merchant.mcc,
      items: body.items ?? [],
      expiresAt: declined ? null : new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
      reversalReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.authorizationsByKey.set(key, authorization);
    return { status: 201, body: authorization };
  }
}

/** Verifies a recorded request the way the core's guard does (P3). */
export function signatureCheck(request: RecordedRequest, secret: string) {
  const header = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  return verifySignature({
    secret,
    method: request.method,
    path: request.path,
    idempotencyKey: header('idempotency-key') ?? '',
    rawBody: request.rawBody,
    signature: header('x-signature'),
    timestamp: header('x-signature-timestamp'),
    nowSeconds: Math.floor(Date.now() / 1000),
    maxSkewSeconds: 300,
  });
}

/** Polls until `check` holds (background captures and webhooks), failing after `timeoutMs`. */
export async function waitFor(check: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
