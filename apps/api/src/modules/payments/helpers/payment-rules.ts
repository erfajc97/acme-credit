import {
  MAX_ACCOUNT_COLLATERAL_CENTS,
  MAX_DEPOSIT_CENTS,
  MIN_DEPOSIT_CENTS,
  type ProviderPayment,
} from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import type { AccountStatus } from '../../../generated/prisma/client';
import { centsToString, type Cents } from '../../../core/money/money';

/** Collateral policy (plan §3): the limit equals the deposit, 100 %, stored per deposit (MO5). */
export const COLLATERAL_LIMIT_RATIO_BPS = 10_000;

/**
 * A deposit is between USD 200 and USD 10,000 (shared constants), on an account that is
 * waiting for collateral or active (an extra deposit raises the limit, R-55).
 */
export function assertDepositAllowed(status: AccountStatus, amount: Cents): void {
  if (amount < MIN_DEPOSIT_CENTS || amount > MAX_DEPOSIT_CENTS) {
    throw new AppHttpException('deposit.amount_out_of_range', {
      minCents: centsToString(MIN_DEPOSIT_CENTS),
      maxCents: centsToString(MAX_DEPOSIT_CENTS),
    });
  }
  if (status === 'CLOSED') throw new AppHttpException('account.closed');
  if (status !== 'PENDING_COLLATERAL' && status !== 'ACTIVE') {
    throw new AppHttpException('account.not_active');
  }
}

/**
 * One account holds at most MAX_ACCOUNT_COLLATERAL_CENTS of collateral: what is confirmed plus
 * what is still in flight (PENDING and not expired) plus this deposit. Checked under the
 * account lock, so two deposits in flight cannot pass it together.
 */
export function assertWithinCollateralCap(input: {
  collateral: Cents;
  pendingDeposits: Cents;
  amount: Cents;
}): void {
  const current = input.collateral + input.pendingDeposits;
  if (current + input.amount > MAX_ACCOUNT_COLLATERAL_CENTS) {
    throw new AppHttpException('payment.deposit_cap_exceeded', {
      maxCents: centsToString(MAX_ACCOUNT_COLLATERAL_CENTS),
      currentCents: centsToString(current),
    });
  }
}

/** When a payment the customer has not approved at the bank stops counting as in flight. */
export function paymentExpiresAt(requestedAt: Date, ttlMinutes: number): Date {
  return new Date(requestedAt.getTime() + ttlMinutes * 60_000);
}

/**
 * A repayment never exceeds what is still owed once the repayments already in flight land, so
 * two pending payments cannot overpay together. No debt at all is its own answer.
 */
export function assertRepaymentAllowed(input: {
  amount: Cents;
  postedDebt: Cents;
  pendingRepayments: Cents;
}): void {
  if (input.postedDebt <= 0n) throw new AppHttpException('repayment.no_debt');
  const outstanding = input.postedDebt - input.pendingRepayments;
  if (input.amount > outstanding) {
    throw new AppHttpException('repayment.exceeds_debt', {
      maxCents: centsToString(outstanding > 0n ? outstanding : 0n),
    });
  }
}

export type PaymentPurpose = 'deposit' | 'repayment' | 'payout';

/**
 * MO4: the provider's payment must be OURS — same reference, amount and purpose as the row we
 * stored. Anything else is never settled.
 */
export function assertPaymentMatches(
  payment: ProviderPayment,
  expected: { reference: string; amountCents: Cents; purpose: PaymentPurpose },
): void {
  const matches =
    payment.reference === expected.reference &&
    payment.amountCents === centsToString(expected.amountCents) &&
    payment.purpose === expected.purpose;
  if (!matches) throw new AppHttpException('payment.not_confirmed', { reason: 'mismatch' });
}
