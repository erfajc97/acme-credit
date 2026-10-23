import type { AdminPayout } from '@acme/contracts';
import type { StatusTone } from '@acme/ui';
import { accountHref } from '@/app/lib/endpoints';
import { formatDateTime } from './dates';
import { formatAmount, formatCount } from './money';
import { PAYOUT_REASON, PAYOUT_STATUS } from './statusLabels';

export interface PayoutRow {
  id: string;
  /** Null on the account's own page (the payouts already belong to it). */
  customer: { name: string; email: string } | null;
  accountHref: string;
  amount: string;
  reasonKey: string;
  statusKey: string;
  tone: StatusTone;
  attempts: string;
  /** Short machine reason of the last failed or unanswered attempt, as the API stores it. */
  lastError: string | null;
  /** The provider's id of the last attempt (what support quotes to the provider). */
  reference: string | null;
  created: string;
  /** What happened last, in words: sent at, failed at, or the next attempt of a pending one. */
  outcome: { labelKey: string; time: string } | null;
}

type PayoutFields = Omit<AdminPayout, 'customer'> & { customer?: AdminPayout['customer'] };

function outcomeOf(payout: PayoutFields): PayoutRow['outcome'] {
  if (payout.status === 'SENT' && payout.sentAt)
    return { labelKey: 'payouts.sentAt', time: formatDateTime(payout.sentAt) };
  if (payout.status === 'FAILED' && payout.failedAt) {
    return { labelKey: 'payouts.failedAt', time: formatDateTime(payout.failedAt) };
  }
  if (payout.status === 'PENDING' && payout.nextAttemptAt) {
    return { labelKey: 'payouts.nextAttemptAt', time: formatDateTime(payout.nextAttemptAt) };
  }
  return null;
}

/** One payout as the payouts list, the account page and the dashboard's alerts show it. */
export function toPayoutRow(payout: PayoutFields): PayoutRow {
  const status = PAYOUT_STATUS[payout.status];
  return {
    id: payout.id,
    customer: payout.customer
      ? { name: payout.customer.fullName, email: payout.customer.email }
      : null,
    accountHref: accountHref(payout.accountId),
    amount: formatAmount(payout.amountCents),
    reasonKey: PAYOUT_REASON[payout.reason],
    statusKey: status.labelKey,
    tone: status.tone,
    attempts: formatCount(payout.attempts),
    lastError: payout.lastError,
    reference: payout.providerPaymentId,
    created: formatDateTime(payout.createdAt),
    outcome: outcomeOf(payout),
  };
}
