import type { ErrorCode } from '@acme/contracts';

export const STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  'common.validation_failed': 422,
  'common.not_found': 404,
  'common.unauthenticated': 401,
  'common.forbidden': 403,
  'common.rate_limited': 429,
  'common.conflict': 409,
  'common.internal': 500,
  'common.payload_too_large': 413,
  'auth.invalid_credentials': 401,
  'auth.email_taken': 409,
  'auth.session_expired': 401,
  'idempotency.key_required': 422,
  'idempotency.key_reused': 409,
  'idempotency.in_progress': 409,
  'operation.in_progress': 409,
  'signature.invalid': 401,
  'account.already_open': 409,
  'account.not_active': 409,
  'account.not_frozen': 409,
  'account.closed': 409,
  'account.pending_holds': 409,
  'deposit.amount_out_of_range': 422,
  'repayment.exceeds_debt': 422,
  'repayment.no_debt': 409,
  'payment.not_confirmed': 409,
  'payment.provider_unavailable': 503,
  'authorization.not_capturable': 409,
  'authorization.not_reversible': 409,
  'authorization.capture_exceeds_hold': 422,
  'authorization.hold_released': 409,
  'account.frozen_by_admin': 409,
  'payment.deposit_cap_exceeded': 422,
};

/** The only way a service reports a business error (AN3): a catalog code plus ids in details. */
export class AppHttpException extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'AppHttpException';
    this.status = STATUS_BY_CODE[code];
  }
}

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}
