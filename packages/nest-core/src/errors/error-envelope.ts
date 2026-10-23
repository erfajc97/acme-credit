import { HttpException } from '@nestjs/common';
import type { ErrorCode, ErrorEnvelope } from '@acme/contracts';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { AppHttpException, statusForCode } from './app-http.exception';

/** Generic, non-leaking messages per code; clients translate by code, never by message. */
const MESSAGE_BY_CODE: Readonly<Record<ErrorCode, string>> = {
  'common.validation_failed': 'The request is not valid.',
  'common.not_found': 'The resource was not found.',
  'common.unauthenticated': 'Authentication is required.',
  'common.forbidden': 'This action is not allowed.',
  'common.rate_limited': 'Too many requests.',
  'common.conflict': 'The request conflicts with the current state.',
  'common.internal': 'Something went wrong.',
  'common.payload_too_large': 'The request body is too large.',
  'auth.invalid_credentials': 'The email or password is not correct.',
  'auth.email_taken': 'An account already uses this email.',
  'auth.session_expired': 'The session has expired.',
  'idempotency.key_required': 'An Idempotency-Key header is required.',
  'idempotency.key_reused': 'This idempotency key was used for a different request.',
  'idempotency.in_progress': 'A request with this idempotency key is still in progress.',
  'operation.in_progress': 'Another operation on this account is in progress.',
  'signature.invalid': 'The request signature is not valid.',
  'account.already_open': 'The customer already has an open account.',
  'account.not_active': 'The account is not active.',
  'account.not_frozen': 'The account is not frozen.',
  'account.closed': 'The account is closed.',
  'account.pending_holds': 'The account has purchases still on hold.',
  'deposit.amount_out_of_range': 'The deposit amount is outside the allowed range.',
  'repayment.exceeds_debt': 'The payment is larger than the amount owed.',
  'repayment.no_debt': 'There is nothing to repay.',
  'payment.not_confirmed': 'The payment is not confirmed by the provider.',
  'payment.provider_unavailable': 'The payment provider is not available.',
  'authorization.not_capturable': 'The authorization cannot be captured.',
  'authorization.not_reversible': 'The authorization cannot be reversed.',
  'authorization.capture_exceeds_hold': 'The capture is larger than the authorized amount.',
  'authorization.hold_released':
    'The hold was released (expired or by an admin) and cannot be captured.',
  'account.frozen_by_admin':
    'The card was frozen by Acme Credit and only Acme Credit can unfreeze it.',
  'payment.deposit_cap_exceeded':
    'The deposit would take the collateral over the per-account maximum.',
};

const CODE_BY_HTTP_STATUS: Readonly<Record<number, ErrorCode>> = {
  400: 'common.validation_failed',
  401: 'common.unauthenticated',
  403: 'common.forbidden',
  404: 'common.not_found',
  405: 'common.not_found',
  409: 'common.conflict',
  413: 'common.payload_too_large',
  415: 'common.validation_failed',
  422: 'common.validation_failed',
  429: 'common.rate_limited',
};

const CODE_BY_PRISMA_CODE: Readonly<Record<string, ErrorCode>> = {
  P2002: 'common.conflict',
  P2025: 'common.not_found',
  P2000: 'common.validation_failed',
};

interface MappedError {
  status: number;
  envelope: ErrorEnvelope;
  /** True when the error is unexpected and must be logged and reported once. */
  unexpected: boolean;
}

function build(code: ErrorCode, requestId: string, details?: Record<string, unknown>): MappedError {
  const envelope: ErrorEnvelope = { code, message: MESSAGE_BY_CODE[code], requestId };
  if (details && Object.keys(details).length > 0) envelope.details = details;
  return { status: statusForCode(code), envelope, unexpected: false };
}

function isPrismaKnownError(error: unknown): error is { name: string; code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'PrismaClientKnownRequestError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/** Client errors raised by Express middleware (body-parser via http-errors): exposed 4xx. */
function exposedClientStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown; expose?: unknown };
  const status = candidate.status ?? candidate.statusCode;
  if (candidate.expose !== true || typeof status !== 'number') return undefined;
  return status >= 400 && status < 500 ? status : undefined;
}

/** Maps any thrown value to the one envelope (A7, AN3). */
export function mapError(error: unknown, requestId: string): MappedError {
  if (error instanceof AppHttpException) return build(error.code, requestId, error.details);

  if (error instanceof ZodValidationException) {
    const zodError = error.getZodError();
    const zodIssues = zodError instanceof ZodError ? zodError.issues : [];
    const issues = zodIssues.map((issue) => ({ path: issue.path.join('.'), code: issue.code }));
    return build('common.validation_failed', requestId, { issues });
  }

  const status = error instanceof HttpException ? error.getStatus() : exposedClientStatus(error);
  const httpCode = status === undefined ? undefined : CODE_BY_HTTP_STATUS[status];
  if (httpCode) return build(httpCode, requestId);

  if (isPrismaKnownError(error)) {
    const code = CODE_BY_PRISMA_CODE[error.code];
    if (code) return build(code, requestId);
  }

  return { ...build('common.internal', requestId), unexpected: true };
}
