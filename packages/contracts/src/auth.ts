import { z } from 'zod';
import { idSchema } from './common';

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 120;

export const ROLES = ['customer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const emailSchema = z.string().trim().toLowerCase().max(EMAIL_MAX).pipe(z.email());

export const registerRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
    fullName: z.string().trim().min(1).max(NAME_MAX),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(PASSWORD_MAX),
    /** Which app is signing in: admins cannot use the customer app and vice versa. */
    audience: z.enum(ROLES),
  })
  .strict();

export const userSchema = z
  .object({ id: idSchema, email: z.string(), fullName: z.string(), role: z.enum(ROLES) })
  .strict();

/**
 * The access token lives in memory only (W14); the refresh token travels in an httpOnly,
 * SameSite=Strict cookie set by /auth/login and rotated by /auth/refresh.
 */
export const sessionSchema = z
  .object({ accessToken: z.string(), expiresInSeconds: z.number().int(), user: userSchema })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type User = z.infer<typeof userSchema>;
export type Session = z.infer<typeof sessionSchema>;
