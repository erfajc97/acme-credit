import type { User } from '@acme/contracts';
import { useQuery } from '@tanstack/react-query';
import { refreshSession } from '@/app/lib/apiClient';
import { useAuthStore } from '@/app/store/authStore';

export const SESSION_KEY = 'session';

/** Asks the API once per page load whether the refresh cookie still holds a session. */
export async function bootstrapSession(): Promise<User | null> {
  const accessToken = await refreshSession();
  return accessToken ? useAuthStore.getState().user : null;
}

/**
 * The session bootstrap (WA11): one refresh per page load, shared by every island through the
 * QueryClient singleton, never inside an effect (W3). A network failure leaves the query in error
 * (shown with a retry), never "signed out".
 */
export function useSessionBootstrap() {
  return useQuery({
    queryKey: [SESSION_KEY],
    queryFn: bootstrapSession,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
