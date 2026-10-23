import { useAuthStore } from '@/app/store/authStore';
import {
  accountsQueryOptions,
  auditLogQueryOptions,
  dashboardQueryOptions,
  journalQueryOptions,
  payoutSampleQueryOptions,
  payoutsQueryOptions,
  purchaseSampleQueryOptions,
  purchasesQueryOptions,
} from '@/app/tanstack-queries/adminQueries';
import { ROUTES } from './endpoints';
import { queryClient } from './queryClient';

/**
 * What each console section reads first. Section links always open the plain list (W17), so the
 * lists are warmed without filters, page 1 only: exactly the cache entry the screen will ask
 * for. `query` is TanStack's non-deprecated prefetch (`prefetchQuery` is deprecated in this
 * version): it fetches only when the entry is missing or stale (staleTime).
 */
const WARMERS: Partial<Record<string, () => Promise<unknown>[]>> = {
  [ROUTES.dashboard]: () => [
    queryClient.query(dashboardQueryOptions()),
    queryClient.query(purchaseSampleQueryOptions(null)),
    queryClient.query(purchaseSampleQueryOptions('APPROVED')),
    queryClient.query(payoutSampleQueryOptions('PENDING')),
    queryClient.query(payoutSampleQueryOptions('FAILED')),
  ],
  [ROUTES.accounts]: () => [queryClient.query(accountsQueryOptions({}))],
  [ROUTES.purchases]: () => [queryClient.query(purchasesQueryOptions({}))],
  [ROUTES.payouts]: () => [queryClient.query(payoutsQueryOptions({}))],
  [ROUTES.ledger]: () => [
    queryClient.query(journalQueryOptions(null)),
    queryClient.query(dashboardQueryOptions()),
  ],
  [ROUTES.auditLog]: () => [queryClient.query(auditLogQueryOptions(null))],
};

/**
 * Warms the next section's queries when the admin shows intent on a nav link (hover, focus,
 * touch), so its data is in the shared cache when the ClientRouter swaps the page in. Only with a
 * session; fresh data (staleTime) is not fetched again. Never rejects.
 */
export function prefetchRouteData(route: string): Promise<void> {
  const warm = WARMERS[route];
  if (!warm || useAuthStore.getState().status !== 'authenticated') return Promise.resolve();
  return Promise.all(warm().map((request) => request.catch(keepCacheAsIs))).then(() => undefined);
}

/**
 * A failed warm-up is not an error to report: the cache stays as it was, and the screen fetches
 * on its own and shows its error state with a retry (W13) if the failure persists.
 */
function keepCacheAsIs(): void {
  // Intentionally nothing: see the comment above.
}
