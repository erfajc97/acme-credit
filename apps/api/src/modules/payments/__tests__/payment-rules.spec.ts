import { describe, expect, it } from 'vitest';
import {
  assertDepositAllowed,
  assertPaymentMatches,
  assertRepaymentAllowed,
  assertWithinCollateralCap,
  COLLATERAL_LIMIT_RATIO_BPS,
  paymentExpiresAt,
} from '../helpers/payment-rules';
import { toDeposit, toRepayment } from '../payment.mapper';

const code = (value: string) => expect.objectContaining({ code: value });

describe('deposit rules (R-01, R-55)', () => {
  it('accepts USD 200.00 to USD 10,000.00 and refuses one cent outside', () => {
    expect(() => assertDepositAllowed('ACTIVE', 20_000n)).not.toThrow();
    expect(() => assertDepositAllowed('ACTIVE', 1_000_000n)).not.toThrow();
    expect(() => assertDepositAllowed('ACTIVE', 19_999n)).toThrow(
      code('deposit.amount_out_of_range'),
    );
    expect(() => assertDepositAllowed('ACTIVE', 1_000_001n)).toThrow(
      code('deposit.amount_out_of_range'),
    );
  });

  it('allows a deposit while waiting for collateral or active, never frozen or closed', () => {
    expect(() => assertDepositAllowed('PENDING_COLLATERAL', 20_000n)).not.toThrow();
    expect(() => assertDepositAllowed('FROZEN', 20_000n)).toThrow(code('account.not_active'));
    expect(() => assertDepositAllowed('CLOSED', 20_000n)).toThrow(code('account.closed'));
  });

  it('grants 100 % of the deposit as limit by policy', () => {
    expect(COLLATERAL_LIMIT_RATIO_BPS).toBe(10_000);
  });
});

describe('collateral cap per account (decision G11, proposal)', () => {
  it('allows confirmed + pending + new up to USD 10,000.00 exactly, and refuses one cent more', () => {
    // Boundary pair: 6,000.00 confirmed + 1,000.00 pending + 3,000.00 new = the cap.
    expect(() =>
      assertWithinCollateralCap({
        collateral: 600_000n,
        pendingDeposits: 100_000n,
        amount: 300_000n,
      }),
    ).not.toThrow();
    expect(() =>
      assertWithinCollateralCap({
        collateral: 600_000n,
        pendingDeposits: 100_000n,
        amount: 300_001n,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'payment.deposit_cap_exceeded',
        status: 422,
        details: { maxCents: '1000000', currentCents: '700000' },
      }),
    );
  });

  it('counts pending deposits, not only confirmed collateral (two deposits in flight)', () => {
    expect(() =>
      assertWithinCollateralCap({ collateral: 0n, pendingDeposits: 1_000_000n, amount: 20_000n }),
    ).toThrow(code('payment.deposit_cap_exceeded'));
    expect(() =>
      assertWithinCollateralCap({ collateral: 1_000_000n, pendingDeposits: 0n, amount: 20_000n }),
    ).toThrow(code('payment.deposit_cap_exceeded'));
  });
});

describe('pending payment expiry (MO5)', () => {
  it('is the request instant plus the configured minutes', () => {
    const now = new Date('2026-10-22T12:00:00.000Z');
    expect(paymentExpiresAt(now, 30).toISOString()).toBe('2026-10-22T12:30:00.000Z');
    expect(paymentExpiresAt(now, 5).toISOString()).toBe('2026-10-22T12:05:00.000Z');
  });
});

describe('repayment rules (R-04)', () => {
  it('repays up to the outstanding debt and not one cent more', () => {
    expect(() =>
      assertRepaymentAllowed({ amount: 5_000n, postedDebt: 5_000n, pendingRepayments: 0n }),
    ).not.toThrow();
    expect(() =>
      assertRepaymentAllowed({ amount: 5_001n, postedDebt: 5_000n, pendingRepayments: 0n }),
    ).toThrow(
      expect.objectContaining({ code: 'repayment.exceeds_debt', details: { maxCents: '5000' } }),
    );
  });

  it('counts repayments already in flight', () => {
    expect(() =>
      assertRepaymentAllowed({ amount: 3_000n, postedDebt: 5_000n, pendingRepayments: 2_000n }),
    ).not.toThrow();
    expect(() =>
      assertRepaymentAllowed({ amount: 3_001n, postedDebt: 5_000n, pendingRepayments: 2_000n }),
    ).toThrow(code('repayment.exceeds_debt'));
    expect(() =>
      assertRepaymentAllowed({ amount: 1n, postedDebt: 5_000n, pendingRepayments: 6_000n }),
    ).toThrow(expect.objectContaining({ details: { maxCents: '0' } }));
  });

  it('says there is nothing to repay without debt', () => {
    expect(() =>
      assertRepaymentAllowed({ amount: 1n, postedDebt: 0n, pendingRepayments: 0n }),
    ).toThrow(code('repayment.no_debt'));
  });
});

describe('assertPaymentMatches (MO4)', () => {
  const payment = {
    id: 'pay_1',
    reference: 'd1',
    amountCents: '20000',
    purpose: 'deposit' as const,
    status: 'SUCCEEDED' as const,
    approveUrl: 'http://provider.test/pay/pay_1',
    createdAt: '2026-10-21T12:00:00.000Z',
    settledAt: null,
  };
  const ours = { reference: 'd1', amountCents: 20_000n, purpose: 'deposit' as const };

  it('accepts only our reference, amount and purpose', () => {
    expect(() => assertPaymentMatches(payment, ours)).not.toThrow();
    for (const foreign of [
      { ...payment, reference: 'd2' },
      { ...payment, amountCents: '20001' },
      { ...payment, purpose: 'repayment' as const },
    ]) {
      expect(() => assertPaymentMatches(foreign, ours)).toThrow(
        expect.objectContaining({ code: 'payment.not_confirmed', details: { reason: 'mismatch' } }),
      );
    }
  });
});

describe('payment mappers', () => {
  const row = {
    id: 'd1',
    accountId: 'a1',
    amountCents: 20_000n,
    status: 'PENDING' as const,
    limitRatioBps: 10_000,
    providerPaymentId: 'pay_1',
    approveUrl: 'http://provider.test/pay/pay_1',
    createdAt: new Date('2026-10-21T12:00:00.000Z'),
    confirmedAt: null,
    expiresAt: new Date('2026-10-21T12:30:00.000Z'),
  };

  it('maps a deposit with its checkout, and a repayment without the ratio', () => {
    expect(toDeposit(row)).toEqual({
      id: 'd1',
      accountId: 'a1',
      amountCents: '20000',
      status: 'PENDING',
      limitRatioBps: 10_000,
      checkout: { paymentId: 'pay_1', approveUrl: 'http://provider.test/pay/pay_1' },
      createdAt: '2026-10-21T12:00:00.000Z',
      confirmedAt: null,
      expiresAt: '2026-10-21T12:30:00.000Z',
    });
    const confirmedAt = new Date('2026-10-21T12:05:00.000Z');
    expect(Object.keys(toRepayment({ ...row, confirmedAt }))).not.toContain('limitRatioBps');
    expect(toRepayment({ ...row, confirmedAt }).confirmedAt).toBe(confirmedAt.toISOString());
  });

  it('never returns a payment without its checkout', () => {
    expect(() => toDeposit({ ...row, approveUrl: null })).toThrow('without its provider checkout');
    expect(() => toRepayment({ ...row, providerPaymentId: null })).toThrow(
      'without its provider checkout',
    );
  });
});
