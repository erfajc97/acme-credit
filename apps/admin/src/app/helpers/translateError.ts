import type { ErrorCode } from '@acme/contracts';

/** The i18n key of an API error code (W6): `auth.email_taken` → `errors.auth.email_taken`. */
export function translateError(code: ErrorCode): string {
  return `errors.${code}`;
}
