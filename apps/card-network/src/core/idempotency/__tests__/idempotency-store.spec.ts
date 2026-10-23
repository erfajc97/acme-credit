import { describe, expect, it, vi } from 'vitest';
import { fingerprintOf, IdempotencyStore } from '../idempotency-store';

const KEY = '0b7a4c2e-1f3d-4a5b-8c6d-7e8f9a0b1c2d';

describe('IdempotencyStore', () => {
  it('runs the work once and replays the stored value for the same key and payload (MO2)', async () => {
    const store = new IdempotencyStore<string>();
    const work = vi.fn(() => Promise.resolve('approved'));
    await expect(store.execute({ key: KEY, fingerprint: 'a', work })).resolves.toBe('approved');
    await expect(store.execute({ key: KEY, fingerprint: 'a', work })).resolves.toBe('approved');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('rejects the same key with another payload with idempotency.key_reused', async () => {
    const store = new IdempotencyStore<string>();
    await store.execute({ key: KEY, fingerprint: 'a', work: () => Promise.resolve('x') });
    const work = vi.fn(() => Promise.resolve('y'));
    await expect(store.execute({ key: KEY, fingerprint: 'b', work })).rejects.toMatchObject({
      code: 'idempotency.key_reused',
    });
    expect(work).not.toHaveBeenCalled();
  });

  it('rejects a concurrent duplicate with idempotency.in_progress instead of running it twice', async () => {
    const store = new IdempotencyStore<string>();
    let release: (value: string) => void = () => undefined;
    const first = store.execute({
      key: KEY,
      fingerprint: 'a',
      work: () => new Promise<string>((resolve) => (release = resolve)),
    });
    await expect(
      store.execute({ key: KEY, fingerprint: 'a', work: () => Promise.resolve('dup') }),
    ).rejects.toMatchObject({ code: 'idempotency.in_progress' });
    release('first');
    await expect(first).resolves.toBe('first');
  });

  it('forgets a failed attempt, so the client may retry with the same key', async () => {
    const store = new IdempotencyStore<string>();
    const failure = Object.assign(new Error('down'), { code: 'payment.provider_unavailable' });
    await expect(
      store.execute({ key: KEY, fingerprint: 'a', work: () => Promise.reject(failure) }),
    ).rejects.toBe(failure);
    await expect(
      store.execute({ key: KEY, fingerprint: 'a', work: () => Promise.resolve('ok') }),
    ).resolves.toBe('ok');
  });
});

describe('fingerprintOf', () => {
  it('is stable for equal values and differs when any field differs', () => {
    expect(fingerprintOf(['purchase', 'tok', '100'])).toBe(
      fingerprintOf(['purchase', 'tok', '100']),
    );
    expect(fingerprintOf(['purchase', 'tok', '100'])).not.toBe(
      fingerprintOf(['purchase', 'tok', '101']),
    );
  });
});
