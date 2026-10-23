import { isInPageChange } from '@/app/helpers/pageParam';

/** Fired after a hook changes the address itself (pushState/replaceState fire no event). */
const ADDRESS_CHANGE_EVENT = 'acme:list-address';

export type HistoryState = Record<string, unknown> | null;

const listeners = new Set<() => void>();
let lastHref = '';

function notify(): void {
  lastHref = window.location.href;
  for (const listener of listeners) listener();
}

/**
 * A move that only opens or closes a sheet or changes a list page is stopped before Astro's
 * ClientRouter sees it: the router listens to popstate on window in the bubble phase, this
 * listener runs in the capture phase first, and without it the router would refetch and swap the
 * whole page. ONE window listener serves every subscriber: a second one would never run once the
 * first stops the event.
 */
function onPopState(event: PopStateEvent): void {
  if (isInPageChange(lastHref, window.location.href)) event.stopImmediatePropagation();
  notify();
}

/** The address as an external store (useSyncExternalStore): Back/Forward or a hook's own write. */
export function subscribeAddress(onChange: () => void): () => void {
  if (listeners.size === 0) {
    lastHref = window.location.href;
    window.addEventListener('popstate', onPopState, { capture: true });
    window.addEventListener(ADDRESS_CHANGE_EVENT, notify);
  }
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (listeners.size > 0) return;
    window.removeEventListener('popstate', onPopState, { capture: true });
    window.removeEventListener(ADDRESS_CHANGE_EVENT, notify);
  };
}

export function currentHistoryState(): HistoryState {
  return window.history.state as HistoryState;
}

export function writeAddress({
  kind,
  state,
  url,
}: {
  kind: 'push' | 'replace';
  state: HistoryState;
  url: string;
}): void {
  if (kind === 'push') window.history.pushState(state, '', url);
  else window.history.replaceState(state, '', url);
  window.dispatchEvent(new Event(ADDRESS_CHANGE_EVENT));
}
