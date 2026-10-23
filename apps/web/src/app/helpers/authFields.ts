import { EMAIL_MAX, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@acme/contracts';
import { z } from 'zod';

/**
 * Form fields shared by sign in and sign up, mirroring the API's DTO caps (W11, G12): the same
 * constants from @acme/contracts, the same trim and lowercase. Messages are i18n keys.
 */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'validation.emailRequired')
  .max(EMAIL_MAX, 'validation.emailTooLong')
  .pipe(z.email('validation.emailInvalid'));

export const newPasswordField = z
  .string()
  .min(PASSWORD_MIN, 'validation.passwordTooShort')
  .max(PASSWORD_MAX, 'validation.passwordTooLong');

export const currentPasswordField = z
  .string()
  .min(1, 'validation.passwordRequired')
  .max(PASSWORD_MAX, 'validation.passwordTooLong');

export const fullNameField = z
  .string()
  .trim()
  .min(1, 'validation.nameRequired')
  .max(NAME_MAX, 'validation.nameTooLong');

export const AUTH_LIMITS = { EMAIL_MAX, PASSWORD_MIN, PASSWORD_MAX, NAME_MAX } as const;
