import { ERROR_CODES } from '@acme/contracts';
import { describe, expect, it } from 'vitest';
import { AppHttpException, STATUS_BY_CODE, statusForCode } from '../app-http.exception';

describe('statusForCode', () => {
  it.each([
    ['common.validation_failed', 422],
    ['common.not_found', 404],
    ['common.unauthenticated', 401],
    ['common.forbidden', 403],
    ['common.rate_limited', 429],
    ['common.conflict', 409],
    ['common.internal', 500],
    ['common.payload_too_large', 413],
    ['auth.invalid_credentials', 401],
    ['auth.email_taken', 409],
    ['auth.session_expired', 401],
    ['idempotency.key_required', 422],
    ['idempotency.key_reused', 409],
    ['idempotency.in_progress', 409],
    ['operation.in_progress', 409],
    ['signature.invalid', 401],
    ['account.already_open', 409],
    ['account.not_active', 409],
    ['account.not_frozen', 409],
    ['account.closed', 409],
    ['account.pending_holds', 409],
    ['deposit.amount_out_of_range', 422],
    ['repayment.exceeds_debt', 422],
    ['repayment.no_debt', 409],
    ['payment.not_confirmed', 409],
    ['payment.provider_unavailable', 503],
    ['authorization.not_capturable', 409],
    ['authorization.not_reversible', 409],
    ['authorization.capture_exceeds_hold', 422],
    ['authorization.hold_released', 409],
    ['account.frozen_by_admin', 409],
    ['payment.deposit_cap_exceeded', 422],
  ] as const)('%s → %i', (code, status) => {
    expect(statusForCode(code)).toBe(status);
  });

  it('covers every catalog code', () => {
    expect(Object.keys(STATUS_BY_CODE).sort()).toEqual([...ERROR_CODES].sort());
  });
});

describe('AppHttpException', () => {
  it('carries code, status and details', () => {
    const error = new AppHttpException('common.forbidden', { accountId: 'a1' });
    expect(error).toMatchObject({
      code: 'common.forbidden',
      status: 403,
      details: { accountId: 'a1' },
      name: 'AppHttpException',
    });
  });
});
