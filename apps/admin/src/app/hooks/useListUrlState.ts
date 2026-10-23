import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { listHref, rememberListQuery } from '@/app/helpers/listMemory';
import type { ListDefinition } from '@/app/helpers/listQuery';
import { pushSearch, URL_CHANGE_EVENT } from '@/app/helpers/navigation';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(URL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(URL_CHANGE_EVENT, onChange);
  };
}

const readSearch = () => window.location.search;
// Islands of the console are client-only; the server snapshot only satisfies React's contract.
const serverSearch = () => '';

/** The address's query string as React state: Back and Forward re-render the subscribers. */
export function useUrlSearch(): string {
  return useSyncExternalStore(subscribe, readSearch, serverSearch);
}

/**
 * A list's filters and page live in the URL (W17): read through the list's parser, written
 * through its serialiser as a new history entry, and remembered for the way back.
 */
export function useListUrlState<Q>(list: ListDefinition<Q>) {
  const search = useUrlSearch();
  const query = useMemo(() => list.parse(search), [list, search]);

  useEffect(() => {
    // Syncs the session memory (an external system) with the address the list now shows.
    rememberListQuery(list, window.location);
  }, [list, search]);

  const setQuery = useCallback((next: Q) => pushSearch(list.serialize(next)), [list]);
  return { query, setQuery };
}

/** The remembered way back to a list, read once when the screen mounts (client-only islands). */
export function useListBackHref<Q>(list: ListDefinition<Q>): string {
  return useMemo(() => listHref(list), [list]);
}
