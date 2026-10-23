import { describe, expect, it } from 'vitest';
import { computeSignature, signRequest, verifySignature } from '../signature';

const KEY = '7c2f1d1e-3b8a-4c41-9a51-0e6f2d9b4c10';
const base = {
  secret: 's3cret',
  method: 'post',
  path: '/v1/network/authorizations',
  idempotencyKey: KEY,
  rawBody: '{"a":1}',
};
const NOW = 1_800_000_000;

function check(overrides: Partial<Parameters<typeof verifySignature>[0]> = {}) {
  const headers = signRequest(base, NOW);
  return verifySignature({
    ...base,
    signature: headers['X-Signature'],
    timestamp: headers['X-Signature-Timestamp'],
    nowSeconds: NOW,
    maxSkewSeconds: 300,
    ...overrides,
  });
}

describe('request signatures (P3)', () => {
  it('accepts a request signed with the same secret, key and bytes', () => {
    expect(check()).toBe('valid');
  });

  it('is case-insensitive on the method only', () => {
    expect(computeSignature({ ...base, timestamp: NOW })).toBe(
      computeSignature({ ...base, method: 'POST', timestamp: NOW }),
    );
  });

  it('signs exactly `timestamp.METHOD.path.idempotencyKey.body` (the documented P3 string)', async () => {
    const { createHmac } = await import('node:crypto');
    const expected = createHmac('sha256', base.secret)
      .update(`${NOW}.POST.${base.path}.${KEY}.${base.rawBody}`)
      .digest('hex');
    expect(computeSignature({ ...base, timestamp: NOW })).toBe(expected);
  });

  it.each([
    ['body', { rawBody: '{"a":2}' }],
    ['whitespace in the body', { rawBody: '{"a": 1}' }],
    ['path', { path: '/v1/network/authorizations/x' }],
    // The replay attack: a captured request resent under another key would be a second effect.
    ['idempotency key', { idempotencyKey: '0b9f3a52-2d7e-4f0c-8a1b-6c5d4e3f2a10' }],
    ['idempotency key, dropped', { idempotencyKey: '' }],
    ['secret', { secret: 'other' }],
    ['signature', { signature: 'ab'.repeat(32) }],
    ['signature length', { signature: 'abcd' }],
  ])('rejects a changed %s', (_label, overrides) => {
    expect(check(overrides)).toBe('mismatch');
  });

  it('signs a call without a key (a GET) over an empty key, and refuses a key added later', () => {
    const unkeyed = { ...base, method: 'GET', idempotencyKey: '', rawBody: '' };
    const headers = signRequest(unkeyed, NOW);
    const verify = (idempotencyKey: string) =>
      verifySignature({
        ...unkeyed,
        idempotencyKey,
        signature: headers['X-Signature'],
        timestamp: headers['X-Signature-Timestamp'],
        nowSeconds: NOW,
        maxSkewSeconds: 300,
      });
    expect(verify('')).toBe('valid');
    expect(verify(KEY)).toBe('mismatch');
  });

  it('refuses a key with the field separator, so key and body cannot trade bytes', () => {
    // `K.{"a"` + `1}` and `K` + `{"a".1}` would sign the same string; keys are UUIDs (no dots).
    const shifted = { ...base, idempotencyKey: `${KEY}.x`, rawBody: 'y' };
    const headers = signRequest(shifted, NOW);
    expect(
      verifySignature({
        ...shifted,
        signature: headers['X-Signature'],
        timestamp: headers['X-Signature-Timestamp'],
        nowSeconds: NOW,
        maxSkewSeconds: 300,
      }),
    ).toBe('missing');
  });

  it('rejects missing or malformed headers', () => {
    expect(check({ signature: undefined })).toBe('missing');
    expect(check({ timestamp: undefined })).toBe('missing');
    expect(check({ timestamp: 'soon' })).toBe('missing');
  });

  it('accepts the last second of the skew window and rejects the first one past it', () => {
    expect(check({ nowSeconds: NOW + 300 })).toBe('valid');
    expect(check({ nowSeconds: NOW + 301 })).toBe('stale');
    expect(check({ nowSeconds: NOW - 300 })).toBe('valid');
    expect(check({ nowSeconds: NOW - 301 })).toBe('stale');
  });
});
