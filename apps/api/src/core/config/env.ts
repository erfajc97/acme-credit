import { baseEnvSchema } from '@acme/nest-core';
import { z } from 'zod';

/** Secrets are long random strings; 32 characters is the floor for HS256 and HMAC keys. */
const SECRET_MIN = 32;

/**
 * Development defaults start with this marker, the same convention as apps/card-network so the
 * two services agree out of the box; production refuses them (A8).
 */
const DEV_DEFAULT_MARKER = 'dev-only-';
const secret = (name: string) =>
  z.string().min(SECRET_MIN).default(`${DEV_DEFAULT_MARKER}${name}-not-a-real-secret`);

const PRODUCTION_SECRETS = [
  'JWT_SECRET',
  'NETWORK_SIGNING_SECRET',
  'PROVIDER_SIGNING_SECRET',
  'PROVIDER_API_SECRET',
] as const;

const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

/** Every variable the lending core reads (G9). Parsed once at boot; production fails closed. */
export const envSchema = baseEnvSchema(3000)
  .extend({
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/\S+$/),
    /** Signs the HS256 access tokens. */
    JWT_SECRET: secret('jwt'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3_600).max(2_592_000).default(604_800),
    /**
     * `Secure` flag of the refresh cookie. Production is always Secure (absent = true, `false`
     * refused); only development may turn it off for plain-http localhost.
     */
    COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    /**
     * SameSite of the refresh cookie. `strict` when the apps share the API's site; `none` when
     * they are on another site (e.g. separate *.onrender.com hosts, a public suffix). `none`
     * needs Secure; CORS (credentials only for CORS_ORIGINS) still decides who may read answers.
     */
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    /** Verifies the card network's calls (P3). */
    NETWORK_SIGNING_SECRET: secret('network-signing'),
    /** Verifies the payment provider's webhooks (P3). */
    PROVIDER_SIGNING_SECRET: secret('provider-signing'),
    /** The payment provider simulator (apps/card-network). */
    PROVIDER_API_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:3001'),
    /** Signs our calls to the provider API. */
    PROVIDER_API_SECRET: secret('provider-api'),
    /** An approved hold nobody captured is released after this long (stored per hold, MO5). */
    HOLD_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    /** A deposit or repayment not approved at the bank by then stops counting as in flight. */
    PENDING_PAYMENT_TTL_MINUTES: z.coerce.number().int().min(5).max(1_440).default(30),
  })
  .superRefine((env, ctx) => {
    const secure = (env.COOKIE_SECURE ?? String(env.NODE_ENV === 'production')) === 'true';
    if (env.COOKIE_SAME_SITE === 'none' && !secure) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SAME_SITE'],
        message: 'none needs a Secure cookie (browsers drop it otherwise)',
      });
    }
    if (env.NODE_ENV !== 'production') return;
    for (const key of PRODUCTION_SECRETS) {
      if (env[key].startsWith(DEV_DEFAULT_MARKER)) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'required in production' });
      }
    }
    if (env.COOKIE_SECURE === 'false') {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'must be true in production',
      });
    }
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: (env.COOKIE_SECURE ?? String(env.NODE_ENV === 'production')) === 'true',
  }));

export type Env = z.infer<typeof envSchema>;

const SEED_PASSWORD_MIN = 12;

/**
 * `.env.example` ships `<generate>` (scripts/up.mjs fills it): a value still wrapped in angle
 * brackets was never filled, so it is a known string, not a password.
 */
const UNFILLED_PLACEHOLDER = /^<.*>$/;

const seedPassword = z
  .string()
  .min(SEED_PASSWORD_MIN)
  .refine((value) => !UNFILLED_PLACEHOLDER.test(value), 'is the .env.example placeholder');

const customerSeedSchema = z.object({
  SEED_CUSTOMER_EMAIL: z.email(),
  SEED_CUSTOMER_PASSWORD: seedPassword,
});

export interface SeedAccount {
  email: string;
  password: string;
}

/**
 * The seed's variables, required only when the seed runs; no password has a default. The demo
 * customer is a known login, so production only creates it when SEED_DEMO_CUSTOMER=true.
 */
export const seedEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SEED_DEMO_CUSTOMER: booleanFlag,
    SEED_ADMIN_EMAIL: z.email(),
    SEED_ADMIN_PASSWORD: seedPassword,
    SEED_CUSTOMER_EMAIL: z.unknown().optional(),
    SEED_CUSTOMER_PASSWORD: z.unknown().optional(),
  })
  .transform((env, ctx): { admin: SeedAccount; customer: SeedAccount | null } => {
    const admin = { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD };
    if (env.NODE_ENV === 'production' && !env.SEED_DEMO_CUSTOMER) return { admin, customer: null };
    const customer = customerSeedSchema.safeParse(env);
    if (!customer.success) {
      for (const issue of customer.error.issues) {
        ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
      return z.NEVER;
    }
    return {
      admin,
      customer: {
        email: customer.data.SEED_CUSTOMER_EMAIL,
        password: customer.data.SEED_CUSTOMER_PASSWORD,
      },
    };
  });

export type SeedEnv = z.infer<typeof seedEnvSchema>;
