import { describe, expect, it } from 'vitest';
import {
  adminAccountDetailSchema,
  adminFreezeRequestSchema,
  adminPayoutSchema,
  adminPayoutsQuerySchema,
  ERROR_CODES,
  FREEZE_REASONS,
  MAX_ACCOUNT_COLLATERAL_CENTS,
  MAX_DEPOSIT_CENTS,
  PAYMENT_STATUSES,
  REVERSAL_REASONS,
} from '../index';

const ID = '7b0d0f8e-3c1a-4c55-9a0e-2b8f1f6c9d10';
const AT = '2026-10-21T12:00:00.000Z';

const payout = {
  id: ID,
  accountId: ID,
  amountCents: '20000',
  reason: 'collateral_release',
  status: 'PENDING',
  attempts: 1,
  providerPaymentId: null,
  lastError: 'provider_unavailable',
  nextAttemptAt: AT,
  createdAt: AT,
  sentAt: null,
  failedAt: null,
  customer: { id: ID, email: 'ana@example.com', fullName: 'Ana' },
};

describe('domain hardening contracts (H2)', () => {
  it('the per-account collateral cap is the single-deposit maximum (decision G11, proposal)', () => {
    expect(MAX_ACCOUNT_COLLATERAL_CENTS).toBe(1_000_000n);
    expect(MAX_ACCOUNT_COLLATERAL_CENTS).toBe(MAX_DEPOSIT_CENTS);
  });

  it('adds the new codes to the catalog', () => {
    expect(ERROR_CODES).toEqual(
      expect.arrayContaining([
        'authorization.hold_released',
        'account.frozen_by_admin',
        'payment.deposit_cap_exceeded',
      ]),
    );
  });

  it('extends the enums additively', () => {
    expect(PAYMENT_STATUSES).toEqual(['PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED']);
    expect(REVERSAL_REASONS).toEqual(['network', 'expired', 'admin_release']);
    expect(FREEZE_REASONS).toEqual([
      'customer_request',
      'admin_review',
      'suspected_fraud',
      'collections',
    ]);
  });

  it('admin freeze: no body or {} means admin_review; unknown reasons and keys are refused', () => {
    expect(adminFreezeRequestSchema.parse(undefined)).toEqual({ reason: 'admin_review' });
    expect(adminFreezeRequestSchema.parse({})).toEqual({ reason: 'admin_review' });
    expect(adminFreezeRequestSchema.parse({ reason: 'suspected_fraud' })).toEqual({
      reason: 'suspected_fraud',
    });
    // A customer reason is not an admin reason.
    expect(adminFreezeRequestSchema.safeParse({ reason: 'customer_request' }).success).toBe(false);
    expect(adminFreezeRequestSchema.safeParse({ reason: 'collections', x: 1 }).success).toBe(false);
  });

  it('payouts: the admin row and its list query', () => {
    expect(adminPayoutSchema.parse(payout)).toEqual(payout);
    expect(adminPayoutSchema.safeParse({ ...payout, status: 'LOST' }).success).toBe(false);
    expect(adminPayoutsQuerySchema.parse({ status: 'FAILED', page: '2', pageSize: '10' })).toEqual({
      status: 'FAILED',
      page: 2,
      pageSize: 10,
    });
    expect(adminPayoutsQuerySchema.safeParse({ pageSize: '11' }).success).toBe(false);
    expect(adminPayoutsQuerySchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('the admin account detail carries its payouts without the customer repeated', () => {
    const { customer: _customer, ...accountPayout } = payout;
    const detail = {
      id: ID,
      status: 'FROZEN',
      currency: 'USD',
      collateralCents: '0',
      creditLimitCents: '0',
      heldCents: '0',
      postedDebtCents: '0',
      availableCents: '0',
      frozenBy: 'ADMIN',
      openedAt: AT,
      activatedAt: AT,
      closedAt: null,
      customer: { id: ID, email: 'ana@example.com', fullName: 'Ana' },
      cardLast4: '4242',
      freezeReason: 'suspected_fraud',
      payouts: [accountPayout],
    };
    expect(adminAccountDetailSchema.parse(detail)).toEqual(detail);
    expect(adminAccountDetailSchema.safeParse({ ...detail, payouts: [payout] }).success).toBe(
      false,
    );
  });
});
