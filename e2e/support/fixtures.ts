import { randomBytes } from 'node:crypto';
import { test as base, type APIRequestContext } from '@playwright/test';
import { closeTestAccount, releaseHold } from './api';
import { skipIntros } from './intros';
import { adminToken } from './session';

/** Every record a spec creates carries this prefix; globalTeardown sweeps whatever is left. */
export const E2E_MARKER_PREFIX = 'e2e-';

/** A unique, recognizable value: `e2e-<time base36>-<random4>`. */
export function e2eMarker(): string {
  return `${E2E_MARKER_PREFIX}${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
}

/**
 * How each kind of record is undone. The API has no delete (the ledger and the audit log are
 * append-only by design), so "undone" means the money is put back: a hold is released and an
 * account is closed, which returns its deposit. Customers themselves stay, marked `e2e-`.
 */
type Undo = (api: APIRequestContext, id: string) => Promise<void>;

const UNDO = {
  authorization: async (api, id) =>
    releaseHold(api, { adminToken: await adminToken(api), authorizationId: id }),
  account: async (api, id) =>
    closeTestAccount(api, { adminToken: await adminToken(api), accountId: id }),
} satisfies Record<string, Undo>;

export type TrackedKind = keyof typeof UNDO;

export interface Created {
  /** Registers a record to undo when the test ends (newest first). */
  track(kind: TrackedKind, id: string): void;
}

export const test = base.extend<{ created: Created }>({
  context: async ({ context }, use) => {
    await skipIntros(context);
    await use(context);
  },
  created: async ({ playwright }, use) => {
    const tracked: { kind: TrackedKind; id: string }[] = [];
    await use({
      track(kind, id) {
        if (!(kind in UNDO)) throw new Error(`e2e: no undo handler for "${kind}"`);
        tracked.push({ kind, id });
      },
    });
    const api = await playwright.request.newContext();
    try {
      // Newest first: a hold is released before its account is closed.
      for (const { kind, id } of tracked.reverse()) {
        await UNDO[kind](api, id);
      }
    } finally {
      await api.dispose();
    }
  },
});

export { expect } from '@playwright/test';
