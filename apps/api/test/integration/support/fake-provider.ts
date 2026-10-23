import { signRequest, verifySignature } from '@acme/nest-core';
import type { ProviderPayment } from '@acme/contracts';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

type Status = ProviderPayment['status'];

interface CreateBody {
  reference: string;
  amountCents: string;
  purpose: ProviderPayment['purpose'];
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

/**
 * A real HTTP payment provider for the tests (FT22): the app's real adapter calls it over the
 * network, signed. It verifies the signature like apps/card-network does, is idempotent by
 * reference, settles payouts at once, and can be switched down (503) to test outages.
 */
export class FakeProvider {
  readonly payments = new Map<string, ProviderPayment>();
  down = false;
  /** How the provider answers a new payout: settled at once by default, or failed / pending. */
  payoutStatus: Status = 'SUCCEEDED';
  rejectedSignatures = 0;
  private server: Server | undefined;

  constructor(private readonly secret: string) {}

  async start(): Promise<string> {
    const server = createServer((request, response) => {
      this.route(request, response).catch((error: unknown) => {
        send(response, 500, { code: 'common.internal', error: String(error) });
      });
    });
    this.server = server;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  byReference(reference: string): ProviderPayment {
    const payment = [...this.payments.values()].find((item) => item.reference === reference);
    if (!payment) throw new Error(`no provider payment for ${reference}`);
    return payment;
  }

  setStatus(reference: string, status: Status): ProviderPayment {
    const payment = this.byReference(reference);
    const settledAt = status === 'PENDING' ? null : new Date().toISOString();
    const updated = { ...payment, status, settledAt };
    this.payments.set(payment.id, updated);
    return updated;
  }

  /** Replaces fields of a stored payment, to simulate a provider answer that is not ours. */
  tamper(reference: string, fields: Partial<ProviderPayment>): void {
    const payment = this.byReference(reference);
    this.payments.set(payment.id, { ...payment, ...fields });
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const path = request.url ?? '';
    const header = (name: string) => {
      const value = request.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const check = verifySignature({
      secret: this.secret,
      method: request.method ?? '',
      path,
      idempotencyKey: header('idempotency-key') ?? '',
      rawBody,
      signature: header('x-signature'),
      timestamp: header('x-signature-timestamp'),
      nowSeconds: Math.floor(Date.now() / 1000),
      maxSkewSeconds: 300,
    });
    if (check !== 'valid') {
      this.rejectedSignatures += 1;
      send(response, 401, { code: 'signature.invalid' });
      return;
    }
    if (this.down) {
      send(response, 503, { code: 'common.internal' });
      return;
    }
    if (request.method === 'POST' && path === '/v1/provider/payments') {
      send(response, 201, this.create(JSON.parse(rawBody) as CreateBody));
      return;
    }
    const match = /^\/v1\/provider\/payments\/([^/]+)$/.exec(path);
    const payment = match ? this.payments.get(decodeURIComponent(match[1] ?? '')) : undefined;
    if (request.method === 'GET' && payment) {
      send(response, 200, payment);
      return;
    }
    send(response, 404, { code: 'common.not_found' });
  }

  private create(body: CreateBody): ProviderPayment {
    const existing = [...this.payments.values()].find((item) => item.reference === body.reference);
    if (existing) return existing;
    const id = `pay_${randomUUID()}`;
    const payout = body.purpose === 'payout';
    const payment: ProviderPayment = {
      id,
      reference: body.reference,
      amountCents: body.amountCents,
      purpose: body.purpose,
      status: payout ? this.payoutStatus : 'PENDING',
      approveUrl: `http://provider.test/pay/${id}`,
      createdAt: new Date().toISOString(),
      settledAt: payout && this.payoutStatus !== 'PENDING' ? new Date().toISOString() : null,
    };
    this.payments.set(id, payment);
    return payment;
  }
}

/** Headers of a request signed like the card network / provider sign theirs (P3). */
export function signedHeaders(input: {
  secret: string;
  method: string;
  path: string;
  idempotencyKey: string;
  rawBody: string;
}) {
  return {
    ...signRequest(input, Math.floor(Date.now() / 1000)),
    'Content-Type': 'application/json',
  };
}
