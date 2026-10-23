import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnvFromProcess, loadSeedEnvFromProcess } from '../env.provider';

const DATABASE_URL = 'postgresql://user:pw@localhost:5434/db';
const REAL_SECRET = 'r'.repeat(40);

describe('lending core env (A8)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', DATABASE_URL);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('listens on 3000 with development defaults that match apps/card-network', () => {
    vi.stubEnv('PORT', undefined);
    const env = loadEnvFromProcess();
    expect(env.PORT).toBe(3000);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_SECONDS).toBe(604_800);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.PROVIDER_API_URL).toBe('http://localhost:3001');
    expect(env.NETWORK_SIGNING_SECRET).toBe('dev-only-network-signing-not-a-real-secret');
  });

  it('reads process.env through the provider', () => {
    vi.stubEnv('PORT', '4100');
    vi.stubEnv('COOKIE_SECURE', 'true');
    const env = loadEnvFromProcess();
    expect(env.PORT).toBe(4100);
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('requires a database URL', () => {
    vi.stubEnv('DATABASE_URL', undefined);
    expect(() => loadEnvFromProcess()).toThrow(/DATABASE_URL/);
    vi.stubEnv('DATABASE_URL', 'mysql://nope');
    expect(() => loadEnvFromProcess()).toThrow(/DATABASE_URL/);
  });

  it('accepts a 32-character secret and refuses a 31-character one', () => {
    vi.stubEnv('JWT_SECRET', 'a'.repeat(32));
    expect(loadEnvFromProcess().JWT_SECRET).toHaveLength(32);
    vi.stubEnv('JWT_SECRET', 'a'.repeat(31));
    expect(() => loadEnvFromProcess()).toThrow(/JWT_SECRET/);
  });

  it('fails closed in production on any development default, naming the key only', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', REAL_SECRET);
    vi.stubEnv('NETWORK_SIGNING_SECRET', REAL_SECRET);
    vi.stubEnv('PROVIDER_SIGNING_SECRET', REAL_SECRET);
    expect(() => loadEnvFromProcess()).toThrow(/PROVIDER_API_SECRET: required in production/);
    vi.stubEnv('PROVIDER_API_SECRET', REAL_SECRET);
    expect(loadEnvFromProcess().NODE_ENV).toBe('production');
    try {
      vi.stubEnv('JWT_SECRET', 'dev-only-jwt-not-a-real-secret');
      loadEnvFromProcess();
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain('dev-only-jwt');
    }
  });

  describe('refresh cookie Secure flag (fails closed in production)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
      for (const key of ['JWT_SECRET', 'NETWORK_SIGNING_SECRET', 'PROVIDER_SIGNING_SECRET']) {
        vi.stubEnv(key, REAL_SECRET);
      }
      vi.stubEnv('PROVIDER_API_SECRET', REAL_SECRET);
    });

    it('is Secure in production when the variable is absent', () => {
      vi.stubEnv('COOKIE_SECURE', undefined);
      expect(loadEnvFromProcess().COOKIE_SECURE).toBe(true);
    });

    it('accepts COOKIE_SECURE=true in production', () => {
      vi.stubEnv('COOKIE_SECURE', 'true');
      expect(loadEnvFromProcess().COOKIE_SECURE).toBe(true);
    });

    it('refuses to boot with COOKIE_SECURE=false in production, naming the key', () => {
      vi.stubEnv('COOKIE_SECURE', 'false');
      expect(() => loadEnvFromProcess()).toThrow(/COOKIE_SECURE: must be true in production/);
    });

    it('keeps SameSite=Strict unless told otherwise', () => {
      expect(loadEnvFromProcess().COOKIE_SAME_SITE).toBe('strict');
    });

    it('accepts SameSite=None for an app on another site (Secure in production)', () => {
      vi.stubEnv('COOKIE_SAME_SITE', 'none');
      expect(loadEnvFromProcess().COOKIE_SAME_SITE).toBe('none');
    });

    it('refuses SameSite=None without Secure, which browsers drop', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('COOKIE_SECURE', 'false');
      vi.stubEnv('COOKIE_SAME_SITE', 'none');
      expect(() => loadEnvFromProcess()).toThrow(/COOKIE_SAME_SITE: none needs a Secure cookie/);
    });

    it('refuses an unknown SameSite value', () => {
      vi.stubEnv('COOKIE_SAME_SITE', 'loose');
      expect(() => loadEnvFromProcess()).toThrow(/COOKIE_SAME_SITE/);
    });

    it('still lets development turn it off for plain-http localhost', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('COOKIE_SECURE', 'false');
      expect(loadEnvFromProcess().COOKIE_SECURE).toBe(false);
    });
  });
});

/** A 16-character stand-in: long enough for the seed, built at runtime so no literal ships. */
const strong = (seed: string) => `${seed}-${'x'.repeat(15 - seed.length)}`;

describe('seed env (P0 security: no demo password in production)', () => {
  const ADMIN = { email: 'admin@acme.test', password: strong('admin') };
  const CUSTOMER = { email: 'demo@acme.test', password: strong('customer') };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SEED_ADMIN_EMAIL', ADMIN.email);
    vi.stubEnv('SEED_ADMIN_PASSWORD', ADMIN.password);
    vi.stubEnv('SEED_CUSTOMER_EMAIL', CUSTOMER.email);
    vi.stubEnv('SEED_CUSTOMER_PASSWORD', CUSTOMER.password);
    vi.stubEnv('SEED_DEMO_CUSTOMER', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  /** The seed's failure message, which the container log shows: it must never echo a value. */
  function seedFailure(): string {
    try {
      loadSeedEnvFromProcess();
    } catch (error) {
      return String(error);
    }
    return expect.unreachable('the seed env should have been refused');
  }

  it('outside production seeds the admin and the demo customer', () => {
    expect(loadSeedEnvFromProcess()).toEqual({ admin: ADMIN, customer: CUSTOMER });
  });

  it('has no default password: a missing one is refused by name', () => {
    vi.stubEnv('SEED_ADMIN_PASSWORD', undefined);
    expect(seedFailure()).toMatch(/SEED_ADMIN_PASSWORD/);
    vi.stubEnv('SEED_ADMIN_PASSWORD', ADMIN.password);
    vi.stubEnv('SEED_CUSTOMER_PASSWORD', undefined);
    expect(seedFailure()).toMatch(/SEED_CUSTOMER_PASSWORD/);
  });

  it('in production skips the demo customer unless SEED_DEMO_CUSTOMER=true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SEED_CUSTOMER_EMAIL', undefined);
    vi.stubEnv('SEED_CUSTOMER_PASSWORD', undefined);
    expect(loadSeedEnvFromProcess()).toEqual({ admin: ADMIN, customer: null });
    vi.stubEnv('SEED_DEMO_CUSTOMER', 'false');
    expect(loadSeedEnvFromProcess().customer).toBeNull();
    vi.stubEnv('SEED_DEMO_CUSTOMER', 'true');
    expect(seedFailure()).toMatch(/SEED_CUSTOMER_PASSWORD/);
    vi.stubEnv('SEED_CUSTOMER_EMAIL', CUSTOMER.email);
    vi.stubEnv('SEED_CUSTOMER_PASSWORD', CUSTOMER.password);
    expect(loadSeedEnvFromProcess().customer).toEqual(CUSTOMER);
  });

  it.each(['development', 'production'])(
    'in %s a password needs 12 characters (11 fails, 12 passes)',
    (mode) => {
      vi.stubEnv('NODE_ENV', mode);
      vi.stubEnv('SEED_ADMIN_PASSWORD', 'a'.repeat(11));
      expect(seedFailure()).toMatch(/SEED_ADMIN_PASSWORD/);
      vi.stubEnv('SEED_ADMIN_PASSWORD', 'a'.repeat(12));
      expect(loadSeedEnvFromProcess().admin.password).toHaveLength(12);
    },
  );

  it('refuses an unfilled .env.example placeholder in production, naming the key, never the value', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SEED_DEMO_CUSTOMER', 'true');
    const placeholder = '<generate-a-password>';
    vi.stubEnv('SEED_CUSTOMER_PASSWORD', placeholder);
    const message = seedFailure();
    expect(message).toMatch(/SEED_CUSTOMER_PASSWORD: is the \.env\.example placeholder/);
    expect(message).not.toContain(placeholder);
    vi.stubEnv('SEED_CUSTOMER_PASSWORD', ADMIN.password);
    vi.stubEnv('SEED_ADMIN_PASSWORD', '<generate>');
    expect(seedFailure()).toMatch(/SEED_ADMIN_PASSWORD/);
  });

  it('a blank customer value (compose passes "") counts as missing', () => {
    vi.stubEnv('SEED_CUSTOMER_EMAIL', '');
    expect(seedFailure()).toMatch(/SEED_CUSTOMER_EMAIL/);
  });
});
