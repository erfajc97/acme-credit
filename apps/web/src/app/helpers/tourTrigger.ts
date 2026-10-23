/**
 * When the wallet tour starts by itself: after EVERY successful sign-in or sign-up (reviewers
 * share the demo account, so "seen once" must not hide it from the next one). The sign-in sets a
 * one-shot request in sessionStorage; the home takes it when the tour starts. A reload, a
 * ClientRouter visit or a session restored by the refresh cookie set nothing, so they never start
 * it. Profile › "Ver tutorial" replays it with `?tour=1`.
 */
export const TOUR_PENDING_KEY = 'acme-tour-pending';
/** E2E bypass: flows under test set it in an init script so the tour never covers the page. */
export const TOUR_SKIP_KEY = 'acme-tour-skip';

type StorageOf = () => Storage;

export function requestTourAfterSignIn(getStorage: StorageOf): void {
  try {
    getStorage().setItem(TOUR_PENDING_KEY, '1');
  } catch {
    // Blocked storage: the tour simply does not start by itself; Profile can still replay it.
  }
}

/** A sign-in asked for the tour and the E2E bypass is off. Blocked storage: no tour. */
export function hasPendingTour(getStorage: StorageOf): boolean {
  try {
    const storage = getStorage();
    return storage.getItem(TOUR_PENDING_KEY) === '1' && storage.getItem(TOUR_SKIP_KEY) !== '1';
  } catch {
    return false;
  }
}

export function clearPendingTour(getStorage: StorageOf): void {
  try {
    getStorage().removeItem(TOUR_PENDING_KEY);
  } catch {
    // Blocked storage never held a request (see hasPendingTour): nothing to clear.
  }
}
