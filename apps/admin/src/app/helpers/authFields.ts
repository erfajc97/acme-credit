import { EMAIL_MAX, PASSWORD_MAX } from '@acme/contracts';
import { z } from 'zod';

/**
 * Sign-in fields mirroring the API's login DTO (W11, G12): the same constants from
 * @acme/contracts, the same trim and lowercase. Messages are i18n keys.
 */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'validation.emailRequired')
  .max(EMAIL_MAX, 'validation.emailTooLong')
  .pipe(z.email('validation.emailInvalid'));

export const currentPasswordField = z
  .string()
  .min(1, 'validation.passwordRequired')
  .max(PASSWORD_MAX, 'validation.passwordTooLong');

export const AUTH_LIMITS = { EMAIL_MAX, PASSWORD_MAX } as const;
