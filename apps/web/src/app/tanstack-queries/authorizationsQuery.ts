import type { Authorization } from '@acme/contracts';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { fetchAuthorizations, type AuthorizationPage } from '@/app/services/accountsApi';
import { ACCOUNT_KEY } from './accountQuery';
import { ACTIVITY_KEY } from './activityQuery';
import { AUTHORIZATION_DETAIL_KEY } from './authorizationDetailQuery';

export const AUTHORIZATIONS_KEY = 'authorizations';

/** The network posts (captures) a hold a few seconds after approving it. */
export const HOLD_POLL_MS = 2000;
/** Holds younger than this are polled until they post; older ones wait for a manual refresh. */
export const HOLD_WATCH_MS = 60 * 1000;

/** Poll while a recent order is still on hold (W3 stop condition: it posts or it ages out). */
export function holdPollInterval(
  items: readonly Authorization[] | undefined,
  now: number,
): number | false {
  const hasFreshHold = (items ?? []).some(
    (item) => item.status === 'APPROVED' && now - Date.parse(item.createdAt) < HOLD_WATCH_MS,
  );
  return hasFreshHold ? HOLD_POLL_MS : false;
}

/** A hold seen on the previous load is now decided (posted, cancelled or declined). */
export function holdsDecidedSince(
  previous: readonly Authorization[] | undefined,
  next: readonly Authorization[],
): boolean {
  const wereHeld = new Set(
    (previous ?? []).filter((item) => item.status === 'APPROVED').map((item) => item.id),
  );
  return next.some((item) => wereHeld.has(item.id) && item.status !== 'APPROVED');
}

/**
 * One definition for the hook and the link-hover prefetch (lib/prefetchRoutes.ts): one numbered
 * page of orders. When a load sees a hold decided, the balances moved (on hold → owed, or
 * released): the account, the activity and the order details are refreshed from here (the query
 * function, not an effect: W3), or the wallet keeps showing the hold for the account's whole
 * staleTime.
 */
export function authorizationsQueryOptions(accountId: string | undefined, page: number) {
  const queryKey = [AUTHORIZATIONS_KEY, accountId, page];
  return queryOptions({
    queryKey,
    queryFn: async ({ client }) => {
      const previous = client.getQueryData<AuthorizationPage>(queryKey)?.items;
      const next = await fetchAuthorizations({ accountId: accountId ?? '', page });
      if (holdsDecidedSince(previous, next.items)) {
        await Promise.all([
          client.invalidateQueries({ queryKey: [ACCOUNT_KEY] }),
          client.invalidateQueries({ queryKey: [ACTIVITY_KEY] }),
          client.invalidateQueries({ queryKey: [AUTHORIZATION_DETAIL_KEY] }),
        ]);
      }
      return next;
    },
    enabled: Boolean(accountId),
  });
}

/** The orders of the account (approved, posted, declined, cancelled), with their lines, by page. */
export function useAuthorizationsQuery(accountId: string | undefined, page: number) {
  return useQuery({
    ...authorizationsQueryOptions(accountId, page),
    // The previous page stays on screen while the next one loads, never flashing a skeleton.
    placeholderData: keepPreviousData,
    refetchInterval: (query) => holdPollInterval(query.state.data?.items, Date.now()),
  });
}
