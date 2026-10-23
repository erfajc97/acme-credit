import { useEffect } from 'react';
import { currentLocation, localHref, navigateTo } from '@/app/helpers/navigation';
import { signInHref } from '@/app/helpers/safeReturnTo';
import { SIGN_IN_PATH } from '@/app/lib/endpoints';
import { useAuthStore } from '@/app/store/authStore';
import { useSessionBootstrap } from '@/app/tanstack-queries/sessionQuery';

export type GateState = 'checking' | 'error' | 'redirecting' | 'ready';

/**
 * Decides what a private island shows (WA11): its skeleton while the session is checked, an
 * error with retry when the check could not run, and the screen once signed in. Without a
 * session it sends the customer to sign in, and back here afterwards unless they signed out.
 */
export function useSessionGate() {
  const session = useSessionBootstrap();
  const status = useAuthStore((state) => state.status);
  const endedByUser = useAuthStore((state) => state.endedByUser);

  const state: GateState =
    status === 'authenticated'
      ? 'ready'
      : status === 'anonymous'
        ? 'redirecting'
        : session.isError
          ? 'error'
          : 'checking';

  useEffect(() => {
    // Navigation is the external system synced here; it runs once the session is known absent.
    if (state !== 'redirecting') return;
    const signIn = localHref(SIGN_IN_PATH);
    navigateTo(endedByUser ? signIn : signInHref(signIn, currentLocation()));
  }, [state, endedByUser]);

  return { state, retry: () => void session.refetch(), isRetrying: session.isFetching };
}
