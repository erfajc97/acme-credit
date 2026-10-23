import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type {
  Account,
  AdminAccount,
  Authorization,
  CheckoutRequest,
  CheckoutResult,
  Deposit,
  Session,
} from '../../packages/contracts/src';
import { IDEMPOTENCY_HEADER } from '../../packages/contracts/src/common';
import { requireEnv } from './env';
import { API_URL, NETWORK_URL } from './urls';

/**
 * The same HTTP doors the apps use, for setup that is not the subject of a spec (an admin spec
 * needs a purchase to look at) and for teardown. Every money POST carries a fresh Idempotency-Key.
 */

async function json<T>(response: APIResponse, what: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(`e2e api: ${what} → ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const keyed = () => ({ [IDEMPOTENCY_HEADER]: randomUUID() });

export interface NewCustomer {
  fullName: string;
  email: string;
  password: string;
}

export async function registerCustomer(
  api: APIRequestContext,
  customer: NewCustomer,
): Promise<Session> {
  const response = await api.post(`${API_URL}/v1/auth/register`, { data: customer });
  return json<Session>(response, 'register');
}

/** The seeded operator, credentials from the root .env (never literals). */
export async function signInAdmin(api: APIRequestContext): Promise<string> {
  const response = await api.post(`${API_URL}/v1/auth/login`, {
    data: {
      email: requireEnv('SEED_ADMIN_EMAIL'),
      password: requireEnv('SEED_ADMIN_PASSWORD'),
      audience: 'admin',
    },
  });
  return (await json<Session>(response, 'admin login')).accessToken;
}

/** A fresh access token from the refresh cookie held by `api` (a browser context's request works). */
export async function refreshAccessToken(api: APIRequestContext): Promise<string> {
  const response = await api.post(`${API_URL}/v1/auth/refresh`, { data: {} });
  return (await json<Session>(response, 'refresh')).accessToken;
}

export async function openAccount(api: APIRequestContext, token: string): Promise<Account> {
  const response = await api.post(`${API_URL}/v1/accounts`, {
    headers: { ...bearer(token), ...keyed() },
    data: {},
  });
  return json<Account>(response, 'open account');
}

export async function myAccount(api: APIRequestContext, token: string): Promise<Account> {
  return json<Account>(
    await api.get(`${API_URL}/v1/accounts/me`, { headers: bearer(token) }),
    'my account',
  );
}

export async function requestDeposit(
  api: APIRequestContext,
  input: { token: string; accountId: string; amountCents: bigint },
): Promise<Deposit> {
  const response = await api.post(`${API_URL}/v1/accounts/${input.accountId}/deposits`, {
    headers: { ...bearer(input.token), ...keyed() },
    data: { amountCents: input.amountCents.toString() },
  });
  return json<Deposit>(response, 'deposit');
}

/** What the bank page's Approve form posts (post/redirect/get: a 303 back to the page). */
export async function approveAtBank(api: APIRequestContext, approveUrl: string): Promise<void> {
  const response = await api.post(`${approveUrl}/approve`, { maxRedirects: 0 });
  expect(response.status(), 'bank approve answers with its redirect').toBe(303);
}

/** The store's checkout at the card network (the browser's own call: SKUs and quantities only). */
export async function checkout(
  api: APIRequestContext,
  request: CheckoutRequest,
): Promise<CheckoutResult> {
  const response = await api.post(`${NETWORK_URL}/v1/checkout`, {
    headers: keyed(),
    data: request,
  });
  return json<CheckoutResult>(response, 'checkout');
}

export async function myAuthorizations(
  api: APIRequestContext,
  input: { token: string; accountId: string },
): Promise<Authorization[]> {
  const response = await api.get(`${API_URL}/v1/accounts/${input.accountId}/authorizations`, {
    headers: bearer(input.token),
  });
  return (await json<{ items: Authorization[] }>(response, 'authorizations')).items;
}

/** Releases a hold at the network. A hold that already posted (409) has nothing left to release. */
/**
 * Releases a live hold through the operator's door (POST /v1/admin/authorizations/:id/release).
 * Customer voids now need the card that made the purchase, which the suite does not keep; an
 * operator release puts the same money back. Not live any more (409) → nothing to do.
 */
export async function releaseHold(
  api: APIRequestContext,
  input: { adminToken: string; authorizationId: string },
): Promise<void> {
  const response = await api.post(
    `${API_URL}/v1/admin/authorizations/${input.authorizationId}/release`,
    { headers: { ...bearer(input.adminToken), ...keyed() } },
  );
  if (response.ok() || response.status() === 409) return;
  throw new Error(
    `e2e api: release ${input.authorizationId} → ${response.status()} ${await response.text()}`,
  );
}

export async function adminAccount(
  api: APIRequestContext,
  input: { adminToken: string; accountId: string },
): Promise<AdminAccount> {
  const response = await api.get(`${API_URL}/v1/admin/accounts/${input.accountId}`, {
    headers: bearer(input.adminToken),
  });
  return json<AdminAccount>(response, 'admin account');
}

/** Every account whose customer name or e-mail matches `query`, across all pages. */
export async function adminSearchAccounts(
  api: APIRequestContext,
  input: { adminToken: string; query: string },
): Promise<AdminAccount[]> {
  const found: AdminAccount[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await api.get(`${API_URL}/v1/admin/accounts`, {
      headers: bearer(input.adminToken),
      params: { q: input.query, page: String(page), pageSize: '10' },
    });
    const body: { items: AdminAccount[]; totalPages: number } = await json(
      response,
      'admin accounts',
    );
    found.push(...body.items);
    totalPages = body.totalPages;
    page += 1;
  } while (page <= totalPages);
  return found;
}

export async function adminAccountAuthorizations(
  api: APIRequestContext,
  input: { adminToken: string; accountId: string },
): Promise<Authorization[]> {
  const response = await api.get(`${API_URL}/v1/admin/accounts/${input.accountId}/authorizations`, {
    headers: bearer(input.adminToken),
    params: { pageSize: '10' },
  });
  // The suite's accounts hold at most a handful of purchases: the first page has them all.
  return (await json<{ items: Authorization[] }>(response, 'admin authorizations')).items;
}

/**
 * Closes an account the suite opened: releases its holds first (a hold blocks closing), then
 * closes it through the admin door, which settles the deposit like a customer close. Already
 * closed → nothing to do.
 */
export async function closeTestAccount(
  api: APIRequestContext,
  input: { adminToken: string; accountId: string },
): Promise<void> {
  const account = await adminAccount(api, input);
  if (account.status === 'CLOSED') return;
  for (const hold of await adminAccountAuthorizations(api, input)) {
    if (hold.status === 'APPROVED')
      await releaseHold(api, { adminToken: input.adminToken, authorizationId: hold.id });
  }
  const response = await api.post(`${API_URL}/v1/admin/accounts/${input.accountId}/close`, {
    headers: { ...bearer(input.adminToken), ...keyed() },
    data: {},
  });
  await json<unknown>(response, `close ${input.accountId}`);
}
