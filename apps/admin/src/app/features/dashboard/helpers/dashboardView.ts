import { ACCOUNT_STATUSES, type AccountStatus, type Dashboard } from '@acme/contracts';
import type { StatusTone } from '@acme/ui';
import { trialBalanceView, type TrialBalanceView } from '@/app/helpers/journal';
import { ACCOUNTS_LIST } from '@/app/helpers/listQuery';
import { formatAmount, formatCount, formatPercent, percentOf } from '@/app/helpers/money';
import { ACCOUNT_STATUS } from '@/app/helpers/statusLabels';
import { accountHref, localHref } from '@/app/lib/endpoints';

export interface StatusCount {
  status: AccountStatus;
  labelKey: string;
  tone: StatusTone;
  count: string;
  /** The accounts list filtered by this status. */
  href: string;
}

/** Per-account reconciliation of the cached balances against the ledger (R-08c). */
export interface ReconciliationView {
  isClean: boolean;
  checked: string;
  mismatches: string;
  /** The first mismatched accounts (up to 10), each linked to its page. */
  accounts: { id: string; shortId: string; href: string }[];
}

export interface DashboardView {
  ledger: TrialBalanceView;
  reconciliation: ReconciliationView;
  accounts: { active: string; frozen: string; total: string; activeHref: string };
  collateral: { amount: string; limit: string };
  /** Held + owed against the credit extended: how much of the lending is in use. */
  creditUsed: { percent: number; label: string; used: string; limit: string };
  purchases24h: { approved: string; declined: string; declineRate: string | null };
  statuses: StatusCount[];
  hasAccounts: boolean;
}

const accountsHref = (status: AccountStatus) =>
  localHref(`${ACCOUNTS_LIST.path}${ACCOUNTS_LIST.serialize({ status })}`);

/** Declined share of the last 24 h decisions; null when there were none (no rate to speak of). */
function declineRate({ approved, declined }: Dashboard['authorizationsLast24h']): string | null {
  const total = approved + declined;
  return total === 0 ? null : formatPercent((declined * 100) / total);
}

/** What the dashboard says, from the API's figures: every number labeled and formatted. */
export function toDashboardView(dashboard: Dashboard): DashboardView {
  // A status the API omits counts as zero rather than hiding the row.
  const countOf = (status: AccountStatus) => dashboard.accountsByStatus[status] ?? 0;
  const total = ACCOUNT_STATUSES.reduce((sum, status) => sum + countOf(status), 0);
  const usedCents = BigInt(dashboard.heldCents) + BigInt(dashboard.receivableCents);
  const usedPercent = percentOf(usedCents, dashboard.creditLimitCents);
  return {
    ledger: trialBalanceView(dashboard.ledgerTrialBalanceCents),
    reconciliation: {
      isClean: dashboard.reconciliation.mismatches === 0,
      checked: formatCount(dashboard.reconciliation.accountsChecked),
      mismatches: formatCount(dashboard.reconciliation.mismatches),
      accounts: dashboard.reconciliation.mismatchedAccountIds.map((id) => ({
        id,
        shortId: id.slice(0, 8),
        href: accountHref(id),
      })),
    },
    accounts: {
      active: formatCount(countOf('ACTIVE')),
      frozen: formatCount(countOf('FROZEN')),
      total: formatCount(total),
      activeHref: accountsHref('ACTIVE'),
    },
    collateral: {
      amount: formatAmount(dashboard.collateralHeldCents),
      limit: formatAmount(dashboard.creditLimitCents),
    },
    creditUsed: {
      percent: usedPercent,
      label: formatPercent(usedPercent),
      used: formatAmount(usedCents),
      limit: formatAmount(dashboard.creditLimitCents),
    },
    purchases24h: {
      approved: formatCount(dashboard.authorizationsLast24h.approved),
      declined: formatCount(dashboard.authorizationsLast24h.declined),
      declineRate: declineRate(dashboard.authorizationsLast24h),
    },
    statuses: ACCOUNT_STATUSES.map((status) => ({
      status,
      labelKey: ACCOUNT_STATUS[status].labelKey,
      tone: ACCOUNT_STATUS[status].tone,
      count: formatCount(countOf(status)),
      href: accountsHref(status),
    })),
    hasAccounts: total > 0,
  };
}
