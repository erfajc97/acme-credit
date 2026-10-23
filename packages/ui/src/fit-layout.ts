import { useMemo, useSyncExternalStore } from 'react';

/** Tailwind's `lg` breakpoint (64rem): two-column screens, the side panel sheet. */
export const DESKTOP_QUERY = '(min-width: 64rem)';

/**
 * When a screen fits the viewport and its panels scroll inside: from lg AND with a fine pointer
 * (mouse, trackpad). Phones, tablets and touch laptops below that scroll the page itself, because
 * a swipe that starts inside a nested scroll box is trapped there. The `fit:` Tailwind variant in
 * theme.css uses this exact query (a spec pins both).
 */
export const FIT_LAYOUT_QUERY = `${DESKTOP_QUERY} and (pointer: fine)`;

/** A mouse or trackpad is the primary pointer (arrow buttons are worth showing). */
export const FINE_POINTER_QUERY = '(pointer: fine)';

function subscribeTo(query: string) {
  return (onChange: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => undefined;
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  };
}

/**
 * Whether a media query matches, kept in sync with the window (resize, a mouse plugged in). The
 * islands that use it are client-only, and the server snapshot is "no match" (the phone layout).
 */
export function useMediaQuery(query: string): boolean {
  // One subscription per query, not one per render.
  const subscribe = useMemo(() => subscribeTo(query), [query]);
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}

/** True when the screen fits the viewport and its panels scroll inside (FIT_LAYOUT_QUERY). */
export function useFitLayout(): boolean {
  return useMediaQuery(FIT_LAYOUT_QUERY);
}
