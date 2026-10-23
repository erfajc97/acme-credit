import { navigate } from 'astro:transitions/client';
import { getActiveLocale } from '@/app/i18n';
import { localizePath } from '@/app/i18n/routing';
import { ROUTES } from '@/app/lib/endpoints';

/**
 * In-app navigation through Astro's ClientRouter (WA4): no full reload, so the QueryClient cache
 * and the in-memory session survive. One door, so the session gate, the 401 handler and the auth
 * forms navigate the same way and tests can observe it.
 */
export function navigateTo(path: string): void {
  // A failed client-side swap (a chunk that did not load) falls back to a full page load.
  navigate(path).catch(() => window.location.assign(path));
}

/** A route of this app in the page's locale: `/app` → `/en/app` on English pages. */
export function localHref(path: string): string {
  return localizePath(path, getActiveLocale());
}

/** `?tour=1` on the wallet home replays the product tour (Profile › "Ver tutorial"). */
export const TOUR_PARAM = 'tour';

/** The wallet home that replays the tour, in the page's locale. */
export function tourReplayHref(): string {
  return `${localHref(ROUTES.app)}?${TOUR_PARAM}=1`;
}

/** Current path + query, read at event time only (never during render: WA2). */
export function currentLocation(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Reads one query parameter of the current URL, at event time only. */
export function currentSearchParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
