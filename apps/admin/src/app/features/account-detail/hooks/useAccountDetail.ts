import type { AdminAccount, AdminAccountDetail } from '@acme/contracts';
import type { StatusTone, VaultSegment as MeterSegment, VaultSegmentTone } from '@acme/ui';
import { useCallback, useMemo } from 'react';
import { formatDate } from '@/app/helpers/dates';
import type { ReleaseTarget } from '@/app/helpers/holds';
import { ACCOUNTS_LIST } from '@/app/helpers/listQuery';
import { formatAmount, percentOf } from '@/app/helpers/money';
import { toPayoutRow } from '@/app/helpers/payouts';
import { ACCOUNT_STATUS, FREEZE_ACTOR, FREEZE_REASON } from '@/app/helpers/statusLabels';
import { useListBackHref, useUrlSearch } from '@/app/hooks/useListUrlState';
import { usePurchaseDetail } from '@/app/hooks/usePurchaseDetail';
import { useReleaseHold } from '@/app/hooks/useReleaseHold';
import { t } from '@/app/i18n';
import { useAccountQuery } from '@/app/tanstack-queries/adminQueries';
import { accountIdFromSearch } from '../helpers/accountActions';
import { useAccountHistory } from './useAccountHistory';

export interface AccountHeaderView {
  name: string;
  email: string;
  statusLabel: string;
  tone: StatusTone;
  accountId: string;
  opened: string;
  closed: string | null;
  card: string | null;
  /** Who froze the card and why, in words, while it is frozen. */
  frozen: { byKey: string; reasonKey: string | null } | null;
}

export interface BalancesView {
  collateral: string;
  limit: string;
  held: string;
  owed: string;
  available: string;
  segments: MeterSegment[];
}

function headerOf(account: AdminAccount): AccountHeaderView {
  const status = ACCOUNT_STATUS[account.status];
  return {
    name: account.customer.fullName,
    email: account.customer.email,
    statusLabel: t(status.labelKey),
    tone: status.tone,
    accountId: account.id,
    opened: formatDate(account.openedAt),
    closed: account.closedAt ? formatDate(account.closedAt) : null,
    card: account.cardLast4 ? t('accounts.cardMasked', { last4: account.cardLast4 }) : null,
    frozen:
      account.status === 'FROZEN' && account.frozenBy
        ? {
            byKey: FREEZE_ACTOR[account.frozenBy],
            reasonKey: account.freezeReason ? FREEZE_REASON[account.freezeReason] : null,
          }
        : null,
  };
}

function balancesOf(account: AdminAccount): BalancesView {
  const limit = account.creditLimitCents;
  const segment = (
    id: string,
    label: string,
    cents: string,
    tone: VaultSegmentTone,
  ): MeterSegment => ({
    id,
    label,
    amount: formatAmount(cents),
    percent: percentOf(cents, limit),
    tone,
  });
  return {
    collateral: formatAmount(account.collateralCents),
    limit: formatAmount(limit),
    held: formatAmount(account.heldCents),
    owed: formatAmount(account.postedDebtCents),
    available: formatAmount(account.availableCents),
    segments: [
      segment('owed', t('accountDetail.owed'), account.postedDebtCents, 'owed'),
      segment('held', t('accountDetail.held'), account.heldCents, 'held'),
      segment('available', t('accountDetail.available'), account.availableCents, 'available'),
    ],
  };
}

/**
 * The account page: which account (`?id=` in the URL), its header and balances, its histories
 * (read in parallel with the account, never after it), its payouts, the "Release hold" dialog of
 * its live holds, the detail sheet of a purchase (`?purchase=<id>`), and the way back to the list the admin came from (W17). A malformed or unknown
 * id is "not found".
 */
export function useAccountDetail() {
  const search = useUrlSearch();
  const accountId = useMemo(() => accountIdFromSearch(search), [search]);
  const query = useAccountQuery(accountId);
  const history = useAccountHistory(accountId);
  const account: AdminAccountDetail | null = query.data ?? null;
  const backHref = useListBackHref(ACCOUNTS_LIST);
  const release = useReleaseHold();
  const customerName = account?.customer.fullName ?? null;
  const customerEmail = account?.customer.email ?? null;
  // Every purchase on this page is this account's: the sheet names its customer.
  const customerOf = useCallback(
    () => (customerName && customerEmail ? { name: customerName, email: customerEmail } : null),
    [customerName, customerEmail],
  );
  const detail = usePurchaseDetail(history.authorizationItems, customerOf);
  return {
    account,
    payouts: useMemo(() => (account ? account.payouts.map(toPayoutRow) : []), [account]),
    // The account's own holds: the confirmation names this customer.
    release: {
      ...release,
      open: (target: ReleaseTarget) => release.open({ ...target, customerName }),
    },
    header: useMemo(() => (account ? headerOf(account) : null), [account]),
    balances: useMemo(() => (account ? balancesOf(account) : null), [account]),
    history,
    detail,
    isLoading: query.isLoading,
    isError: query.isError,
    isNotFound: accountId === null || (query.isSuccess && account === null),
    retry: () => void query.refetch(),
    isRetrying: query.isFetching,
    backHref,
  };
}
