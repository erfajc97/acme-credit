import { describe, expect, it } from 'vitest';
import { parseIdempotencyKey } from '../idempotency-key';

const KEY = '0b7a4c2e-1f3d-4a5b-8c6d-7e8f9a0b1c2d';

describe('parseIdempotencyKey', () => {
  it('accepts a UUID and normalizes it to lower case (one key, one effect)', () => {
    expect(parseIdempotencyKey(KEY)).toBe(KEY);
    expect(parseIdempotencyKey(` ${KEY.toUpperCase()} `)).toBe(KEY);
    expect(parseIdempotencyKey([KEY, 'ignored'])).toBe(KEY);
  });

  it('rejects a missing or blank header with idempotency.key_required', () => {
    for (const header of [undefined, '', '   ', []]) {
      expect(() => parseIdempotencyKey(header)).toThrow(
        expect.objectContaining({
          code: 'idempotency.key_required',
          details: { reason: 'missing' },
        }),
      );
    }
  });

  it('rejects a value that is not a UUID with idempotency.key_required', () => {
    expect(() => parseIdempotencyKey('retry-1')).toThrow(
      expect.objectContaining({
        code: 'idempotency.key_required',
        details: { reason: 'malformed' },
      }),
    );
  });
});
