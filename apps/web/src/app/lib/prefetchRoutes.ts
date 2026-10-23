import type { Account } from '@acme/contracts';
import { useAuthStore } from '@/app/store/authStore';
import { ACCOUNT_KEY, accountQueryOptions } from '@/app/tanstack-queries/accountQuery';
import { activityQueryOptions } from '@/app/tanstack-queries/activityQuery';
import { authorizationsQueryOptions } from '@/app/tanstack-queries/authorizationsQuery';
import { ROUTES } from './endpoints';
import { queryClient } from './queryClient';

/** Section links open a list fresh (W17): its first page is what the screen shows first. */
const FIRST_PAGE = 1;

/**
 * Warms the next screen's queries when the customer shows intent on a nav link (hover, focus,
 * touch), so its data is in the shared cache when the ClientRouter swaps the page in. Cheap on
 * purpose: only with a session and a cached account, and prefetch skips fresh data (staleTime).
 * Returns what it started, for tests and for callers that want to wait.
 */
export function prefetchRouteData(route: string): Promise<unknown> {
  if (useAuthStore.getState().status !== 'authenticated') return Promise.resolve();
  const accountId = queryClient.getQueryData<Account | null>([ACCOUNT_KEY])?.id;
  if (!accountId) return Promise.resolve();
  if (route === ROUTES.activity) {
    return Promise.all([
      queryClient.query(authorizationsQueryOptions(accountId, FIRST_PAGE)).catch(keepCacheAsIs),
      queryClient.query(activityQueryOptions(accountId, FIRST_PAGE)).catch(keepCacheAsIs),
    ]);
  }
  if (route === ROUTES.app)
    return queryClient
      .query(authorizationsQueryOptions(accountId, FIRST_PAGE))
      .catch(keepCacheAsIs);
  // The card page reads the account only: refresh it when stale (a freeze from another tab).
  if (route === ROUTES.card) return queryClient.query(accountQueryOptions()).catch(keepCacheAsIs);
  return Promise.resolve();
}

/**
 * A failed warm-up is not an error to report: the cache stays as it was, and the screen fetches
 * on its own and shows its error state with a retry (W13) if the failure persists.
 */
function keepCacheAsIs(): void {
  // Intentionally nothing: see the comment above.
}
