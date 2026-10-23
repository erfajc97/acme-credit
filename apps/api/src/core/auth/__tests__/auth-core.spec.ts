import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env';
import { AccessTokens } from '../access-tokens';
import { PasswordHasher } from '../password-hasher';

const SECRET = 's'.repeat(40);
const env = { JWT_SECRET: SECRET, ACCESS_TOKEN_TTL_SECONDS: 900 } as Env;
const key = new TextEncoder().encode(SECRET);

function bearer(token: string) {
  return { headers: { authorization: `Bearer ${token}` } };
}

describe('AccessTokens', () => {
  const tokens = new AccessTokens(env);

  it('issues a token that authenticates back to the same principal', async () => {
    const token = await tokens.issue({ id: 'u1', role: 'admin' });
    await expect(tokens.authenticate(bearer(token))).resolves.toEqual({ id: 'u1', role: 'admin' });
    expect(tokens.ttlSeconds).toBe(900);
  });

  it('treats a missing, foreign, expired or role-less token as no principal', async () => {
    await expect(tokens.authenticate({ headers: {} })).resolves.toBeNull();
    await expect(
      tokens.authenticate({ headers: { authorization: 'Basic abc' } }),
    ).resolves.toBeNull();
    await expect(tokens.authenticate(bearer('not.a.jwt'))).resolves.toBeNull();

    const foreign = await new AccessTokens({ ...env, JWT_SECRET: 'o'.repeat(40) }).issue({
      id: 'u1',
      role: 'admin',
    });
    await expect(tokens.authenticate(bearer(foreign))).resolves.toBeNull();

    const expired = await new SignJWT({ role: 'customer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setIssuer('acme-credit/lending-core')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(key);
    await expect(tokens.authenticate(bearer(expired))).resolves.toBeNull();

    const unknownRole = await new SignJWT({ role: 'root' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setIssuer('acme-credit/lending-core')
      .setExpirationTime('1m')
      .sign(key);
    await expect(tokens.authenticate(bearer(unknownRole))).resolves.toBeNull();

    const noSubject = await new SignJWT({ role: 'customer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('acme-credit/lending-core')
      .setExpirationTime('1m')
      .sign(key);
    await expect(tokens.authenticate(bearer(noSubject))).resolves.toBeNull();
  });
});

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes with Argon2id and verifies only the right password', async () => {
    const hash = await hasher.hash('correct horse');
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(hasher.verify(hash, 'correct horse')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong horse')).resolves.toBe(false);
  });

  it('still does the work for an unknown user, and never says yes', async () => {
    await expect(hasher.verify(null, 'decoy-password-never-matches')).resolves.toBe(false);
    await expect(hasher.verify(null, 'anything')).resolves.toBe(false);
  });
});
