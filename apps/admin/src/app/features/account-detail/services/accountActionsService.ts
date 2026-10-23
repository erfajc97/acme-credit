import {
  adminAccountActionSchema,
  adminCloseAccountResponseSchema,
  type AdminAccountAction,
  type AdminCloseAccountResponse,
} from '@acme/contracts';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';
import { withIdempotencyKey } from '@/app/lib/idempotency';
import type { AdminFreezeReason } from '../helpers/accountActions';

/**
 * Admin actions on an account. Each carries a client-generated Idempotency-Key that survives a
 * retry after a timeout (MO2), bound to the action and the account. The answers carry the card
 * masked (last 4 only): the back office never receives the card token (A5).
 */
/** The reason is part of the intent: the same account frozen for another reason is a new key. */
export function freezeAccount(
  accountId: string,
  reason: AdminFreezeReason,
): Promise<AdminAccountAction> {
  return withIdempotencyKey(
    { action: 'admin.account.freeze', payload: { accountId, reason } },
    (idempotencyKey) =>
      apiRequest({
        path: ENDPOINTS.admin.freeze(accountId),
        method: 'POST',
        body: { reason },
        schema: adminAccountActionSchema,
        idempotencyKey,
      }),
  );
}

export function unfreezeAccount(accountId: string): Promise<AdminAccountAction> {
  return withIdempotencyKey(
    { action: 'admin.account.unfreeze', payload: { accountId } },
    (idempotencyKey) =>
      apiRequest({
        path: ENDPOINTS.admin.unfreeze(accountId),
        method: 'POST',
        schema: adminAccountActionSchema,
        idempotencyKey,
      }),
  );
}

export function closeAccount(accountId: string): Promise<AdminCloseAccountResponse> {
  return withIdempotencyKey(
    { action: 'admin.account.close', payload: { accountId } },
    (idempotencyKey) =>
      apiRequest({
        path: ENDPOINTS.admin.close(accountId),
        method: 'POST',
        schema: adminCloseAccountResponseSchema,
        idempotencyKey,
      }),
  );
}
