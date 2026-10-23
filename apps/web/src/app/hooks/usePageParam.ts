import { useSyncExternalStore } from 'react';
import { pageUrl, readPageParam, type ListPageParam } from '@/app/helpers/pageParam';
import { currentHistoryState, subscribeAddress, writeAddress } from './listAddress';

/**
 * A list's page, kept in its own query parameter (W17: one parser, readPageParam). Each change
 * pushes a history entry, so Back walks through the pages; a shared link opens on its page.
 */
export function usePageParam(name: ListPageParam) {
  const page = useSyncExternalStore(
    subscribeAddress,
    () => readPageParam(window.location.search, name),
    () => 1,
  );
  return {
    page,
    setPage: (next: number) => {
      // Astro's own entry data (index, scroll) is kept so its later navigations stay consistent.
      writeAddress({
        kind: 'push',
        state: { ...currentHistoryState() },
        url: pageUrl({ href: window.location.href, name, page: next }),
      });
    },
  };
}
