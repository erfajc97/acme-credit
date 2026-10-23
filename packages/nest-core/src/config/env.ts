import { z } from 'zod';

/** Variables every service reads (G9). Each service extends this with its own. */
export function baseEnvSchema(defaultPort: number) {
  return z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(defaultPort),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    /**
     * Proxies in front of the service whose X-Forwarded-For is trusted (Render, an ALB: 1).
     * 0 (default) ignores the header, so a client cannot choose its own rate-limit bucket.
     */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      ),
  });
}

export type BaseEnv = z.infer<ReturnType<typeof baseEnvSchema>>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment: ${issues.join('; ')}`);
    this.name = 'EnvValidationError';
  }
}

/** Parses once at boot and fails closed, naming keys but never values. */
export function loadEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return parsed.data;
}
