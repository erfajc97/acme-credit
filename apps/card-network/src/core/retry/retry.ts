/** Waits `ms`; resolves early (never rejects) when `signal` aborts, so shutdown is not delayed. */
export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export const sleep: Sleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });

/** `retries` is the number of attempts AFTER the first one. */
export interface RetryPolicy {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** Exponential backoff: base, 2×base, 4×base… capped at `maxDelayMs`. `retry` starts at 1. */
export function backoffDelayMs(policy: RetryPolicy, retry: number): number {
  return Math.min(policy.baseDelayMs * 2 ** (retry - 1), policy.maxDelayMs);
}

/**
 * Runs `run` and repeats it while `shouldRetry` says the result is retryable (a timeout, a
 * network error, a 5xx), at most `policy.retries` more times. The caller keeps the SAME
 * idempotency key across attempts, so a retry can never apply an effect twice (P3).
 */
export async function retryWithBackoff<T>(input: {
  run: (attempt: number) => Promise<T>;
  shouldRetry: (result: T) => boolean;
  policy: RetryPolicy;
  sleep: Sleep;
  signal?: AbortSignal;
}): Promise<T> {
  let result = await input.run(1);
  for (let retry = 1; retry <= input.policy.retries; retry += 1) {
    if (!input.shouldRetry(result) || input.signal?.aborted) break;
    await input.sleep(backoffDelayMs(input.policy, retry), input.signal);
    if (input.signal?.aborted) break;
    result = await input.run(retry + 1);
  }
  return result;
}
