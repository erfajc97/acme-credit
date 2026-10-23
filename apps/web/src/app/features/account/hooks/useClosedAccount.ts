import type { Account } from '@acme/contracts';
import { formatAmount } from '@/app/helpers/money';
import { useActivityQuery } from '@/app/tanstack-queries/activityQuery';
import { settlementFromActivity } from '../helpers/accountView';
import { useOpenAccountMutation } from '../mutations/useAccountMutations';

/** A closed account: what happened to the security deposit (from the ledger) and a new start. */
export function useClosedAccount(account: Account) {
  // The settlement is among the newest movements: the first page holds it.
  const activity = useActivityQuery(account.id, 1);
  const openAccount = useOpenAccountMutation();
  const items = activity.data?.items ?? [];
  const settlement = settlementFromActivity(items);
  return {
    settlement: settlement && {
      collateral: formatAmount(settlement.collateralCents),
      applied: formatAmount(settlement.appliedToDebtCents),
      released: formatAmount(settlement.releasedCents),
    },
    isLoading: activity.isLoading,
    isError: activity.isError,
    // refetch never rejects: a failure lands in the query state, shown by the error branch.
    retry: () => void activity.refetch(),
    isRetrying: activity.isFetching,
    openNew: () => openAccount.mutate(),
    isOpening: openAccount.isPending,
  };
}
