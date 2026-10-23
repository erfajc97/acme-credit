import { describe, expect, it } from 'vitest';
import { ERROR_CODES, errorEnvelopeSchema, isErrorCode } from '../errors';

describe('error catalog', () => {
  it('has unique codes', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('recognises catalog codes and rejects anything else', () => {
    expect(isErrorCode('common.not_found')).toBe(true);
    expect(isErrorCode('common.nope')).toBe(false);
    expect(isErrorCode(404)).toBe(false);
  });

  it('accepts a valid envelope and rejects unknown codes or extra keys', () => {
    const base = { code: 'common.not_found', message: 'Not found', requestId: 'r-1' };
    expect(errorEnvelopeSchema.safeParse(base).success).toBe(true);
    expect(errorEnvelopeSchema.safeParse({ ...base, code: 'x.y' }).success).toBe(false);
    expect(errorEnvelopeSchema.safeParse({ ...base, stack: 'leak' }).success).toBe(false);
  });
});
