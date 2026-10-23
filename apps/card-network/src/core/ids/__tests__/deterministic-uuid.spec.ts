import { idempotencyKeySchema } from '@acme/contracts';
import { describe, expect, it } from 'vitest';
import { deterministicUuid } from '../deterministic-uuid';

describe('deterministicUuid', () => {
  it('derives the same key from the same name, so a retried capture reuses its key', () => {
    expect(deterministicUuid('capture:a')).toBe(deterministicUuid('capture:a'));
  });

  it('derives different keys from different names', () => {
    expect(deterministicUuid('capture:a')).not.toBe(deterministicUuid('capture:b'));
    expect(deterministicUuid('capture:a')).not.toBe(deterministicUuid('reversal:a'));
  });

  it('is a version-5 RFC 4122 UUID the core accepts as an Idempotency-Key', () => {
    const key = deterministicUuid('webhook:payment-1');
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idempotencyKeySchema.safeParse(key).success).toBe(true);
  });
});
