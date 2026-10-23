import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiClient';

const MAX_QUERY_RETRIES = 1;
/** Account and activity stay fresh for 30 s: coming back to a screen shows them at once. */
const QUERY_STALE_MS = 30_000;
/** Cached screens survive ten minutes of navigating elsewhere (ClientRouter keeps this module). */
const QUERY_GC_MS = 10 * 60 * 1000;

/** A 4xx fails the same way again; only "no answer" and 5xx deserve one retry (W4). */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

/**
 * The one QueryClient of the tab (W4, WA3): every island imports this module, so they share one
 * cache, and with the ClientRouter the module survives navigation, so a screen the customer comes
 * back to renders from cache without a skeleton. Hooks reach it through useQueryClient().
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_MS,
      gcTime: QUERY_GC_MS,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    // Money mutations are never retried blindly: the customer retries with the same key (MO2).
    mutations: { retry: false },
  },
});
