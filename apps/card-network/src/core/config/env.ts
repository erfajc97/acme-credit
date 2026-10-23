import { baseEnvSchema } from '@acme/nest-core';
import { z } from 'zod';

/** Development defaults start with this marker; production refuses them (A8). */
const DEV_DEFAULT_MARKER = 'dev-only-';

const SECRET_KEYS = [
  'NETWORK_SIGNING_SECRET',
  'PROVIDER_SIGNING_SECRET',
  'PROVIDER_API_SECRET',
] as const;

const secret = (name: string) =>
  z.string().min(32).default(`${DEV_DEFAULT_MARKER}${name}-not-a-real-secret`);

const httpUrl = (fallback: string) => z.url({ protocol: /^https?$/ }).default(fallback);

/** Every variable the card network and payment provider simulator reads (G9). */
export const envSchema = baseEnvSchema(3001)
  .extend({
    /** The lending core (apps/api). */
    CORE_API_URL: httpUrl('http://localhost:3000'),
    /** Our own public origin, used in the provider's `approveUrl`. */
    PUBLIC_URL: httpUrl('http://localhost:3001'),
    /** The customer app; the pay page links back to it. */
    WEB_URL: httpUrl('http://localhost:4321'),
    /** Signs our calls to the core's network API (P3). */
    NETWORK_SIGNING_SECRET: secret('network-signing'),
    /** Signs the provider's webhooks to the core (P3). */
    PROVIDER_SIGNING_SECRET: secret('provider-signing'),
    /** The core signs its calls to our provider API with it. */
    PROVIDER_API_SECRET: secret('provider-api'),
    /** Delay between an approved purchase and its capture. */
    CAPTURE_DELAY_MS: z.coerce.number().int().min(0).max(600_000).default(4_000),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of SECRET_KEYS) {
      if (env[key].startsWith(DEV_DEFAULT_MARKER)) {
        context.addIssue({ code: 'custom', path: [key], message: 'required in production' });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
