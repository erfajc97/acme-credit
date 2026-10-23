import { useEffect } from 'react';
import { currentLocation, navigateTo } from '@/app/helpers/navigation';
import { signInHref } from '@/app/helpers/safeReturnTo';
import { localHref, SIGN_IN_PATH } from '@/app/lib/endpoints';
import { useAuthStore } from '@/app/store/authStore';
import { useSessionBootstrap } from '@/app/tanstack-queries/sessionQuery';

export type GateState = 'checking' | 'error' | 'redirecting' | 'forbidden' | 'ready';

/**
 * Decides what a private island shows (WA11): its skeleton while the session is checked, an
 * error with retry when the check could not run, and the screen once an admin is signed in.
 * Without a session it sends the visitor to sign in and back here afterwards. The refresh
 * cookie belongs to the API origin, so a customer signed in to the customer app arrives here
 * with a customer session: that is "forbidden", not the console (the API refuses it anyway).
 */
export function useSessionGate() {
  const session = useSessionBootstrap();
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);

  const state: GateState =
    status === 'authenticated'
      ? role === 'admin'
        ? 'ready'
        : 'forbidden'
      : status === 'anonymous'
        ? 'redirecting'
        : session.isError
          ? 'error'
          : 'checking';

  useEffect(() => {
    // Navigation is the external system synced here; it runs once the session is known absent.
    if (state === 'redirecting') navigateTo(signInHref(localHref(SIGN_IN_PATH), currentLocation()));
  }, [state]);

  return { state, retry: () => void session.refetch(), isRetrying: session.isFetching };
}
