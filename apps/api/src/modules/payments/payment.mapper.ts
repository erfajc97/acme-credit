import type { Deposit, Repayment } from '@acme/contracts';
import type { Prisma } from '../../generated/prisma/client';
import { centsToString } from '../../core/money/money';

export const depositSelect = {
  id: true,
  accountId: true,
  amountCents: true,
  status: true,
  limitRatioBps: true,
  providerPaymentId: true,
  approveUrl: true,
  createdAt: true,
  confirmedAt: true,
  expiresAt: true,
} satisfies Prisma.CollateralDepositSelect;

export const repaymentSelect = {
  id: true,
  accountId: true,
  amountCents: true,
  status: true,
  providerPaymentId: true,
  approveUrl: true,
  createdAt: true,
  confirmedAt: true,
  expiresAt: true,
} satisfies Prisma.RepaymentSelect;

export type DepositRow = Prisma.CollateralDepositGetPayload<{ select: typeof depositSelect }>;
export type RepaymentRow = Prisma.RepaymentGetPayload<{ select: typeof repaymentSelect }>;

function checkoutOf(row: { providerPaymentId: string | null; approveUrl: string | null }) {
  // Rows are only returned once the provider answered; a gap here is a bug, not a state.
  if (row.providerPaymentId === null || row.approveUrl === null) {
    throw new Error('payment row without its provider checkout');
  }
  return { paymentId: row.providerPaymentId, approveUrl: row.approveUrl };
}

export function toRepayment(row: RepaymentRow): Repayment {
  return {
    id: row.id,
    accountId: row.accountId,
    amountCents: centsToString(row.amountCents),
    status: row.status,
    checkout: checkoutOf(row),
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export function toDeposit(row: DepositRow): Deposit {
  return { ...toRepayment(row), limitRatioBps: row.limitRatioBps };
}
