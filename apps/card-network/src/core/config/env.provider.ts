import { loadEnv } from '@acme/nest-core';
import { envSchema, type Env } from './env';

export const ENV = Symbol('ENV');

export function loadEnvFromProcess(): Env {
  return loadEnv(envSchema, process.env);
}
