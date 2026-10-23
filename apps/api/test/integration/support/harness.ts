import type { Account } from '@acme/contracts';
import type { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { AccessTokens } from '../../../src/core/auth/access-tokens';
import { createApi } from '../../../src/core/http/create-api';
import { PrismaClient } from '../../../src/generated/prisma/client';
import { FakeProvider, signedHeaders } from './fake-provider';

export interface Harness {
  app: INestApplication;
  http: ReturnType<typeof request>;
  db: PrismaClient;
  provider: FakeProvider;
  close(): Promise<void>;
}

export function testEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`missing ${key} in the test env`);
  return value;
}

/** Boots the whole app with the SAME bootstrap as main.ts (AN14), wired to a fake provider. */
export async function startHarness(): Promise<Harness> {
  const provider = new FakeProvider(testEnv('PROVIDER_API_SECRET'));
  process.env.PROVIDER_API_URL = await provider.start();
  const app = await createApi(AppModule, { CORS_ORIGINS: [] }, { logger: false });
  // One real listener: supertest would otherwise bind the server once per request.
  await app.listen(0, '127.0.0.1');
  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testEnv('DATABASE_URL') }),
  });
  return {
    app,
    http: request(`http://127.0.0.1:${port}`),
    db,
    provider,
    async close() {
      await app.close();
      await db.$disconnect();
      await provider.stop();
    },
  };
}

export interface TestUser {
  id: string;
  email: string;
  auth: { Authorization: string };
}

/** A user straight in the database (no auth throttle spent) with a real access token. */
export async function createUser(
  h: Harness,
  role: 'customer' | 'admin' = 'customer',
): Promise<TestUser> {
  const email = `${role}-${randomUUID()}@acme.test`;
  const user = await h.db.user.create({
    data: { email, passwordHash: 'not-a-login', fullName: `${role} ${email.slice(0, 13)}`, role },
    select: { id: true },
  });
  const token = await h.app.get(AccessTokens).issue({ id: user.id, role });
  return { id: user.id, email, auth: { Authorization: `Bearer ${token}` } };
}

export const key = () => ({ 'Idempotency-Key': randomUUID() });

/** A POST signed like the given caller signs it (P3), with an optional idempotency key. */
export function signedPost(
  h: Harness,
  caller: 'network' | 'provider',
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const rawBody = JSON.stringify(body);
  const secret = testEnv(
    caller === 'network' ? 'NETWORK_SIGNING_SECRET' : 'PROVIDER_SIGNING_SECRET',
  );
  // The key is part of the signed string (P3), exactly as the caller sends it.
  const idempotencyKey = headers['Idempotency-Key'] ?? '';
  return h.http
    .post(path)
    .set({
      ...signedHeaders({ secret, method: 'POST', path, idempotencyKey, rawBody }),
      ...headers,
    })
    .send(rawBody);
}

export function webhook(h: Harness, reference: string) {
  const payment = h.provider.byReference(reference);
  return signedPost(h, 'provider', '/v1/webhooks/payments', { paymentId: payment.id, reference });
}

export async function openAccount(h: Harness, user: TestUser): Promise<Account> {
  const res = await h.http.post('/v1/accounts').set(user.auth).set(key());
  if (res.status !== 201)
    throw new Error(`open account: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as Account;
}

export async function deposit(h: Harness, user: TestUser, accountId: string, amountCents: string) {
  const res = await h.http
    .post(`/v1/accounts/${accountId}/deposits`)
    .set(user.auth)
    .set(key())
    .send({ amountCents });
  if (res.status !== 201) throw new Error(`deposit: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string };
}

/** The provider approves the payment and tells us; returns the webhook response. */
export function approve(h: Harness, reference: string) {
  h.provider.setStatus(reference, 'SUCCEEDED');
  return webhook(h, reference);
}

/** Open → deposit → provider approves → webhook: an ACTIVE account with a card. */
export async function activeAccount(
  h: Harness,
  user: TestUser,
  depositCents = '20000',
): Promise<Account> {
  const account = await openAccount(h, user);
  const created = await deposit(h, user, account.id, depositCents);
  const hook = await approve(h, created.id);
  if (hook.status !== 204) throw new Error(`webhook: ${hook.status} ${JSON.stringify(hook.body)}`);
  const mine = await h.http.get('/v1/accounts/me').set(user.auth);
  return mine.body as Account;
}

export function purchase(
  h: Harness,
  cardToken: string,
  amountCents: string,
  idempotencyKey = randomUUID(),
) {
  return signedPost(
    h,
    'network',
    '/v1/network/authorizations',
    { cardToken, amountCents, merchant: { name: 'Corner Grocery', mcc: '5411' } },
    { 'Idempotency-Key': idempotencyKey },
  );
}

export async function trialBalance(h: Harness): Promise<bigint> {
  const sum = await h.db.posting.aggregate({ _sum: { amountCents: true } });
  return sum._sum.amountCents ?? 0n;
}
