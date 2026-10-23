import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { fetchActivity } from '@/app/services/accountsApi';

export const ACTIVITY_KEY = 'activity';

/** One definition for the hook and the link-hover prefetch (lib/prefetchRoutes.ts). */
export function activityQueryOptions(accountId: string | undefined, page: number) {
  return queryOptions({
    queryKey: [ACTIVITY_KEY, accountId, page],
    queryFn: () => fetchActivity({ accountId: accountId ?? '', page }),
    enabled: Boolean(accountId),
  });
}

/** The account's activity, newest first, one numbered page at a time. */
export function useActivityQuery(accountId: string | undefined, page: number) {
  return useQuery({
    ...activityQueryOptions(accountId, page),
    // The previous page stays on screen while the next one loads, never flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}
