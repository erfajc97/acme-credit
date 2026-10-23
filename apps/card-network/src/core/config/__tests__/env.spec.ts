import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnvFromProcess } from '../env.provider';

const SECRETS = {
  NETWORK_SIGNING_SECRET: 'n'.repeat(32),
  PROVIDER_SIGNING_SECRET: 'p'.repeat(32),
  PROVIDER_API_SECRET: 'a'.repeat(32),
};

function stubAll(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe('card network env', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('listens on 3001 by default', () => {
    vi.stubEnv('PORT', undefined);
    expect(loadEnvFromProcess().PORT).toBe(3001);
  });

  it('reads process.env through the provider', () => {
    vi.stubEnv('PORT', '4100');
    expect(loadEnvFromProcess().PORT).toBe(4100);
  });

  it('defaults to the local stack outside production (core 3000, web 4321, 4 s capture)', () => {
    stubAll({
      NODE_ENV: 'development',
      CORE_API_URL: undefined,
      PUBLIC_URL: undefined,
      WEB_URL: undefined,
      CAPTURE_DELAY_MS: undefined,
    });
    expect(loadEnvFromProcess()).toMatchObject({
      CORE_API_URL: 'http://localhost:3000',
      PUBLIC_URL: 'http://localhost:3001',
      WEB_URL: 'http://localhost:4321',
      CAPTURE_DELAY_MS: 4000,
    });
  });

  it('starts in production with real secrets', () => {
    stubAll({ NODE_ENV: 'production', ...SECRETS });
    expect(loadEnvFromProcess().PROVIDER_API_SECRET).toBe(SECRETS.PROVIDER_API_SECRET);
  });

  it('fails closed in production on each development-default secret, naming the key only (A8)', () => {
    for (const key of Object.keys(SECRETS)) {
      stubAll({ NODE_ENV: 'production', ...SECRETS, [key]: undefined });
      expect(() => loadEnvFromProcess()).toThrow(key);
    }
  });

  it('rejects a secret one character shorter than 32, accepts 32', () => {
    stubAll({ NODE_ENV: 'development', NETWORK_SIGNING_SECRET: 'x'.repeat(31) });
    expect(() => loadEnvFromProcess()).toThrow('NETWORK_SIGNING_SECRET');
    vi.stubEnv('NETWORK_SIGNING_SECRET', 'x'.repeat(32));
    expect(loadEnvFromProcess().NETWORK_SIGNING_SECRET).toHaveLength(32);
  });

  it('rejects a core URL that is not http(s)', () => {
    vi.stubEnv('CORE_API_URL', 'file:///etc/passwd');
    expect(() => loadEnvFromProcess()).toThrow('CORE_API_URL');
  });
});
