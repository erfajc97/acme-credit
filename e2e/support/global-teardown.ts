import { request, type APIRequestContext } from '@playwright/test';
import { adminSearchAccounts, closeTestAccount } from './api';
import { E2E_MARKER_PREFIX } from './fixtures';
import { adminToken } from './session';

/** Accounts of `e2e-` customers that are still open: what a killed spec left behind. */
export async function openE2eAccounts(api: APIRequestContext, token: string) {
  const accounts = await adminSearchAccounts(api, { adminToken: token, query: E2E_MARKER_PREFIX });
  return accounts.filter(
    (account) =>
      account.status !== 'CLOSED' && account.customer.email.startsWith(E2E_MARKER_PREFIX),
  );
}

/** The sweep: a spec killed mid-way never reaches its own teardown, this closes what it opened. */
export default async function globalTeardown(): Promise<void> {
  const api = await request.newContext();
  try {
    const token = await adminToken(api);
    for (const account of await openE2eAccounts(api, token)) {
      await closeTestAccount(api, { adminToken: token, accountId: account.id });
    }
  } finally {
    await api.dispose();
  }
}
