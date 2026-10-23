import type { AdminAccountDetail, AdminPayout } from '@acme/contracts';
import type { Prisma } from '../../../generated/prisma/client';
import { centsToString } from '../../../core/money/money';

/** Every payout column a response may show (A5). */
export const payoutSelect = {
  id: true,
  accountId: true,
  amountCents: true,
  reason: true,
  status: true,
  attempts: true,
  providerPaymentId: true,
  lastError: true,
  nextAttemptAt: true,
  createdAt: true,
  sentAt: true,
  failedAt: true,
} satisfies Prisma.PayoutSelect;

export const adminPayoutSelect = {
  ...payoutSelect,
  account: { select: { customer: { select: { id: true, email: true, fullName: true } } } },
} satisfies Prisma.PayoutSelect;

type PayoutRow = Prisma.PayoutGetPayload<{ select: typeof payoutSelect }>;
type AdminPayoutRow = Prisma.PayoutGetPayload<{ select: typeof adminPayoutSelect }>;

export type AccountPayout = AdminAccountDetail['payouts'][number];

export function toAccountPayout(row: PayoutRow): AccountPayout {
  return {
    id: row.id,
    accountId: row.accountId,
    amountCents: centsToString(row.amountCents),
    reason: row.reason,
    status: row.status,
    attempts: row.attempts,
    providerPaymentId: row.providerPaymentId,
    lastError: row.lastError,
    // Only a PENDING payout is scheduled; a settled one keeps the column but shows none.
    nextAttemptAt: row.status === 'PENDING' ? row.nextAttemptAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
  };
}

export function toAdminPayout(row: AdminPayoutRow): AdminPayout {
  const { customer } = row.account;
  return {
    ...toAccountPayout(row),
    customer: { id: customer.id, email: customer.email, fullName: customer.fullName },
  };
}
