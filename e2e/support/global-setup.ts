import { request } from '@playwright/test';
import { adminToken } from './session';
import { ADMIN_URL, API_URL, NETWORK_URL, WEB_URL } from './urls';

const READY_DEADLINE_MS = 120_000;
const POLL_MS = 1_000;

/** The pages and endpoints that answer 2xx only when each app is up (the suite never starts them). */
const READINESS = [`${API_URL}/ready`, `${NETWORK_URL}/health`, `${WEB_URL}/`, `${ADMIN_URL}/`];

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    // Connection refused or timed out: not ready yet, the poll asks again.
    return false;
  }
}

async function waitUntilReady(url: string): Promise<void> {
  const deadline = Date.now() + READY_DEADLINE_MS;
  while (!(await answers(url))) {
    if (Date.now() > deadline) {
      throw new Error(
        `e2e: ${url} did not answer 2xx within 120 s. Start the stack with \`pnpm docker:up\`.`,
      );
    }
    await new Promise((resolve) => {
      setTimeout(resolve, POLL_MS);
    });
  }
}

export default async function globalSetup(): Promise<void> {
  await Promise.all(READINESS.map(waitUntilReady));
  // One operator sign-in per run at most (throttled endpoint); specs' teardown reuses it.
  const api = await request.newContext();
  try {
    await adminToken(api);
  } finally {
    await api.dispose();
  }
}
