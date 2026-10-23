import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchMyAccount } from '@/app/services/accountsApi';
import { useAuthStore } from '@/app/store/authStore';

export const ACCOUNT_KEY = 'account';

/** The account query's key and fetcher, shared by the hook and the nav-intent prefetch. */
export function accountQueryOptions() {
  return queryOptions({ queryKey: [ACCOUNT_KEY], queryFn: fetchMyAccount });
}

/** The customer's account (null = none opened yet). Private: waits for the session (W4). */
export function useAccountQuery() {
  const status = useAuthStore((state) => state.status);
  return useQuery({ ...accountQueryOptions(), enabled: status === 'authenticated' });
}
