import type { Authorization } from '@acme/contracts';
import { vi } from 'vitest';
import type { BackgroundTask, BackgroundTasks } from '../background/background-tasks';
import type { CoreCallResult, CoreClient } from '../core-client/core-client.port';

export const AUTH_ID = '6d1f8a2b-3c4d-4e5f-9a0b-1c2d3e4f5a6b';
export const KEY = '0b7a4c2e-1f3d-4a5b-8c6d-7e8f9a0b1c2d';
export const OTHER_KEY = '1c8b5d3f-2a4e-4b6c-9d7e-8f9a0b1c2d3e';

export function authorization(overrides: Partial<Authorization> = {}): Authorization {
  return {
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
    ...overrides,
  };
}

const OK_NULL: CoreCallResult<null> = { kind: 'ok', value: null };

/** The core port, answering from per-method defaults that each test overrides. */
export function fakeCore() {
  return {
    authorize: vi.fn<CoreClient['authorize']>(() =>
      Promise.resolve({ kind: 'ok', value: authorization() }),
    ),
    capture: vi.fn<CoreClient['capture']>(() => Promise.resolve(OK_NULL)),
    reverse: vi.fn<CoreClient['reverse']>(() => Promise.resolve(OK_NULL)),
    notifyPayment: vi.fn<CoreClient['notifyPayment']>(() => Promise.resolve(OK_NULL)),
  };
}

/** A scheduler that only runs tasks when the test says so (no timers, FT7). */
export function fakeTasks() {
  const pending = new Map<string, { delayMs: number; task: BackgroundTask }>();
  const signal = new AbortController().signal;
  const tasks = {
    pending,
    schedule: vi.fn((key: string, delayMs: number, task: BackgroundTask) => {
      pending.set(key, { delayMs, task });
    }),
    cancel: vi.fn((key: string) => pending.delete(key)),
    /** Starts a pending task the way the timer would, and waits for it. */
    async run(key: string) {
      const entry = pending.get(key);
      if (!entry) throw new Error(`no pending task ${key}`);
      pending.delete(key);
      await entry.task(signal);
    },
  };
  return { tasks, asTasks: tasks as unknown as BackgroundTasks };
}
