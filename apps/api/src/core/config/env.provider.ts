import { loadEnv } from '@acme/nest-core';
import { envSchema, seedEnvSchema, type Env, type SeedEnv } from './env';

export const ENV = Symbol('ENV');

/** The only reader of `process.env` in the app (A8). */
export function loadEnvFromProcess(): Env {
  return loadEnv(envSchema, process.env);
}

export function loadSeedEnvFromProcess(): SeedEnv {
  return loadEnv(seedEnvSchema, process.env);
}
