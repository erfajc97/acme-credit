import type { AuthorizationDetail } from '@acme/contracts';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchAuthorizationDetail } from '@/app/services/accountsApi';

export const AUTHORIZATION_DETAIL_KEY = 'authorizationDetail';

/** One definition for the hook and any warm-up: an order with its lines and timeline. */
export function authorizationDetailQueryOptions(
  accountId: string | undefined,
  authorizationId: string | null,
) {
  return queryOptions({
    queryKey: [AUTHORIZATION_DETAIL_KEY, accountId, authorizationId],
    queryFn: () => fetchAuthorizationDetail(accountId ?? '', authorizationId ?? ''),
    enabled: Boolean(accountId && authorizationId),
  });
}

interface DetailQueryInput {
  accountId: string | undefined;
  authorizationId: string | null;
  /** What the list already knows about this order: the sheet opens with it at once. */
  placeholder: AuthorizationDetail | undefined;
}

/** The order behind `?order=<id>`. Shown from the list row while the full detail loads. */
export function useAuthorizationDetailQuery({
  accountId,
  authorizationId,
  placeholder,
}: DetailQueryInput) {
  return useQuery({
    ...authorizationDetailQueryOptions(accountId, authorizationId),
    ...(placeholder ? { placeholderData: placeholder } : {}),
  });
}
