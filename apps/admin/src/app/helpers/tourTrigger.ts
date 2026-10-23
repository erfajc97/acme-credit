/*
 * The product tour opens after EVERY successful admin sign-in (owner decision: reviewers share one
 * demo account, so "seen once on this device" would hide it from the next one), and never on a
 * reload, a ClientRouter navigation or a session restored by the refresh cookie. The sign-in sets a
 * one-shot flag for this tab; the tour takes it (reads and removes it) once the session is there.
 */

/** Set by a successful sign-in; consumed by the tour. */
export const TOUR_PENDING_KEY = 'acme-admin-tour-pending';
/** E2E bypass: with `'1'` in this tab's sessionStorage the tour never opens on its own. */
export const TOUR_SKIP_KEY = 'acme-admin-tour-skip';

type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function requestTourAfterSignIn(storage: TabStorage): void {
  try {
    storage.setItem(TOUR_PENDING_KEY, '1');
  } catch {
    // Storage blocked: the tour simply does not open on its own; the menu still replays it.
  }
}

/** Is a sign-in waiting for its tour? Removes the request, so it opens once. */
export function takeTourRequest(storage: TabStorage): boolean {
  try {
    const pending = storage.getItem(TOUR_PENDING_KEY) === '1';
    storage.removeItem(TOUR_PENDING_KEY);
    return pending && storage.getItem(TOUR_SKIP_KEY) !== '1';
  } catch {
    // Storage blocked: never auto-start (the menu's replay still works).
    return false;
  }
}
