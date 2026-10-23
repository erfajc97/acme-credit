import { localHref } from '@/app/helpers/navigation';
import { ROUTES } from '@/app/lib/endpoints';
import { useAccountQuery } from '@/app/tanstack-queries/accountQuery';
import { accountViewOf } from '../helpers/accountView';

/** The account home: which life-cycle screen to show, with the query's four states (W13). */
export function useAccountHome() {
  const query = useAccountQuery();
  return {
    account: query.data ?? null,
    view: query.data === undefined ? null : accountViewOf(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
    // refetch never rejects: a failure lands in the query state, shown by the error branch.
    retry: () => void query.refetch(),
    isRetrying: query.isFetching,
    walletHref: localHref(ROUTES.app),
  };
}
