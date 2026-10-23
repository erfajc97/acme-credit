import { afterEach, describe, expect, it, vi } from 'vitest';
import { backoffDelayMs, retryWithBackoff, sleep, type RetryPolicy } from '../retry';

const POLICY: RetryPolicy = { retries: 3, baseDelayMs: 100, maxDelayMs: 250 };

/** Scripted outcomes, one per attempt; `true` = success. */
function scripted(outcomes: boolean[]) {
  const run = vi.fn((attempt: number) => Promise.resolve(outcomes[attempt - 1] ?? false));
  return run;
}

describe('backoffDelayMs', () => {
  it('doubles from the base delay and caps at the max (100, 200, 250, 250)', () => {
    expect([1, 2, 3, 4].map((retry) => backoffDelayMs(POLICY, retry))).toEqual([
      100, 200, 250, 250,
    ]);
  });
});

describe('retryWithBackoff', () => {
  const noWait = () => vi.fn((_ms: number, _signal?: AbortSignal) => Promise.resolve());

  it('does not retry a result that is final', async () => {
    const run = scripted([true]);
    const wait = noWait();
    await expect(
      retryWithBackoff({ run, shouldRetry: (ok) => !ok, policy: POLICY, sleep: wait }),
    ).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('retries a retryable result until it succeeds, waiting the backoff in between', async () => {
    const run = scripted([false, false, true]);
    const wait = noWait();
    await expect(
      retryWithBackoff({ run, shouldRetry: (ok) => !ok, policy: POLICY, sleep: wait }),
    ).resolves.toBe(true);
    expect(run.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 3]);
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
  });

  it('gives up after `retries` retries (1 + 3 attempts) and returns the last result', async () => {
    const run = scripted([false, false, false, false, true]);
    await expect(
      retryWithBackoff({ run, shouldRetry: (ok) => !ok, policy: POLICY, sleep: noWait() }),
    ).resolves.toBe(false);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('stops retrying once the signal aborts (app shutdown)', async () => {
    const controller = new AbortController();
    const run = vi.fn((attempt: number) => {
      if (attempt === 2) controller.abort();
      return Promise.resolve(false);
    });
    await retryWithBackoff({
      run,
      shouldRetry: (ok) => !ok,
      policy: POLICY,
      sleep: noWait(),
      signal: controller.signal,
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not run again when the signal aborts during the wait', async () => {
    const controller = new AbortController();
    const run = scripted([false, true]);
    const wait = vi.fn(() => {
      controller.abort();
      return Promise.resolve();
    });
    await retryWithBackoff({
      run,
      shouldRetry: (ok) => !ok,
      policy: POLICY,
      sleep: wait,
      signal: controller.signal,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('sleep', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves after the delay', async () => {
    vi.useFakeTimers();
    let done = false;
    const pending = sleep(1_000).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(done).toBe(true);
  });

  it('resolves early when the signal aborts, and at once when it already has', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = sleep(60_000, controller.signal);
    controller.abort();
    await expect(pending).resolves.toBeUndefined();
    await expect(sleep(60_000, controller.signal)).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
