import { z } from 'zod';

/**
 * The one error catalog (A7). Clients branch on `code`, never on `message`.
 * Append new codes; never rename or reuse one.
 */
export const ERROR_CODES = [
  'common.validation_failed',
  'common.not_found',
  'common.unauthenticated',
  'common.forbidden',
  'common.rate_limited',
  'common.conflict',
  'common.internal',
  'common.payload_too_large',
  'auth.invalid_credentials',
  'auth.email_taken',
  'auth.session_expired',
  'idempotency.key_required',
  'idempotency.key_reused',
  'idempotency.in_progress',
  'operation.in_progress',
  'signature.invalid',
  'account.already_open',
  'account.not_active',
  'account.not_frozen',
  'account.closed',
  'account.pending_holds',
  'deposit.amount_out_of_range',
  'repayment.exceeds_debt',
  'repayment.no_debt',
  'payment.not_confirmed',
  'payment.provider_unavailable',
  'authorization.not_capturable',
  'authorization.not_reversible',
  'authorization.capture_exceeds_hold',
  'authorization.hold_released',
  'account.frozen_by_admin',
  'payment.deposit_cap_exceeded',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorEnvelopeSchema = z
  .object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
