import { navigate } from 'astro:transitions/client';

/** Fired after the console changes the address itself (pushState does not fire popstate). */
export const URL_CHANGE_EVENT = 'acme:urlchange';

/**
 * In-app navigation through Astro's ClientRouter (WA4): no full reload, so the QueryClient cache
 * and the in-memory session survive. One door, so the session gate, the 401 handler and the auth
 * forms navigate the same way and tests can observe it.
 */
export function navigateTo(path: string): void {
  // A failed client-side swap (a chunk that did not load) falls back to a full page load.
  navigate(path).catch(() => window.location.assign(path));
}

/** Current path + query, read at event time only (never during a server render: WA2). */
export function currentLocation(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Reads one query parameter of the current URL, at event time only. */
export function currentSearchParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Puts a list's new query in the address as a new history entry (W17: the browser's Back walks
 * through filters and pages), then tells the URL subscribers. The entry carries no state on
 * purpose: the ClientRouter ignores stateless entries, so Back between two filters of the same
 * list stays inside the island instead of fetching the page again.
 */
export function pushSearch(search: string): void {
  window.history.pushState(null, '', `${window.location.pathname}${search}`);
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

/**
 * Swaps the current address's query without a new history entry (closing a deep-linked sheet, so
 * Back never reopens it), then tells the URL subscribers.
 */
export function replaceSearch(search: string): void {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}`);
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}
