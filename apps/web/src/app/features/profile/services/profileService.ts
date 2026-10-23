import { closeAccountResponseSchema, type Account, type Settlement } from '@acme/contracts';
import { z } from 'zod';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';
import { withIdempotencyKey } from '@/app/lib/idempotency';

/** POST /auth/logout: 204, the API clears the refresh cookie. */
export function signOut(): Promise<undefined> {
  return apiRequest({ path: ENDPOINTS.auth.logout, method: 'POST', schema: z.undefined() });
}

/** Closes the account: the deposit pays what is owed and the rest is returned (keyed, MO2). */
export function closeAccount(
  accountId: string,
): Promise<{ account: Account; settlement: Settlement }> {
  return withIdempotencyKey({ action: 'account.close', payload: { accountId } }, (idempotencyKey) =>
    apiRequest({
      path: ENDPOINTS.accounts.close(accountId),
      method: 'POST',
      schema: closeAccountResponseSchema,
      idempotencyKey,
    }),
  );
}
