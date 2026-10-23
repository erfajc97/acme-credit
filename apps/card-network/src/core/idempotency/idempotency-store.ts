import { createHash } from 'node:crypto';
import { AppHttpException } from '@acme/nest-core';

type Entry<T> =
  { fingerprint: string; state: 'in_progress' } | { fingerprint: string; state: 'done'; value: T };

/**
 * In-memory idempotency for the simulator's browser-facing routes (MO2). A restart forgets
 * every key — acceptable for a simulator, because the core keeps its own durable record of
 * the same key and answers a replay with the stored decision (ADR-0004).
 */
export class IdempotencyStore<T> {
  private readonly entries = new Map<string, Entry<T>>();

  /**
   * Runs `work` once per key. Same key + same payload → the stored value; same key + other
   * payload → 409 `idempotency.key_reused`; a duplicate still running → 409
   * `idempotency.in_progress`. A failure is NOT stored: the client retries with the same key.
   */
  async execute(input: { key: string; fingerprint: string; work: () => Promise<T> }): Promise<T> {
    const existing = this.entries.get(input.key);
    if (existing) {
      if (existing.fingerprint !== input.fingerprint) {
        throw new AppHttpException('idempotency.key_reused');
      }
      if (existing.state === 'in_progress') throw new AppHttpException('idempotency.in_progress');
      return existing.value;
    }

    this.entries.set(input.key, { fingerprint: input.fingerprint, state: 'in_progress' });
    try {
      const value = await input.work();
      this.entries.set(input.key, { fingerprint: input.fingerprint, state: 'done', value });
      return value;
    } catch (error) {
      this.entries.delete(input.key);
      throw error;
    }
  }
}

/** SHA-256 of a value the caller builds field by field, so key order never matters. */
export function fingerprintOf(value: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
