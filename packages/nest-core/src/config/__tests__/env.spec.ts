import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { baseEnvSchema, EnvValidationError, loadEnv } from '../env';

const schema = baseEnvSchema(3000);

describe('baseEnvSchema', () => {
  it('applies defaults and splits the CORS allowlist', () => {
    const env = loadEnv(schema, { CORS_ORIGINS: 'http://a.test, http://b.test ,' });
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('defaults CORS to an empty allowlist (closed)', () => {
    expect(loadEnv(schema, {}).CORS_ORIGINS).toEqual([]);
  });

  it('uses the service default port', () => {
    expect(loadEnv(baseEnvSchema(3001), {}).PORT).toBe(3001);
  });

  it('bounds PORT on both ends and requires an integer', () => {
    expect(loadEnv(schema, { PORT: '1' }).PORT).toBe(1);
    expect(() => loadEnv(schema, { PORT: '0' })).toThrow(EnvValidationError);
    expect(loadEnv(schema, { PORT: '65535' }).PORT).toBe(65_535);
    expect(() => loadEnv(schema, { PORT: '65536' })).toThrow(EnvValidationError);
    expect(() => loadEnv(schema, { PORT: '3000.5' })).toThrow(EnvValidationError);
  });
});

describe('loadEnv', () => {
  it('fails closed naming the key, never the value', () => {
    try {
      loadEnv(schema, { NODE_ENV: 'staging-secret-value' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const issues = (error as EnvValidationError).issues;
      expect(issues[0]).toMatch(/^NODE_ENV:/);
      expect(issues.join()).not.toContain('staging-secret-value');
    }
  });

  it('works with a service schema that extends the base', () => {
    const extended = schema.extend({ CORE_URL: z.url() });
    expect(loadEnv(extended, { CORE_URL: 'http://core.test' }).CORE_URL).toBe('http://core.test');
    expect(() => loadEnv(extended, {})).toThrow(EnvValidationError);
  });
});
