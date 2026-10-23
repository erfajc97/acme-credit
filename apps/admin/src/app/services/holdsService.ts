import { authorizationSchema, type Authorization } from '@acme/contracts';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';
import { withIdempotencyKey } from '@/app/lib/idempotency';

/**
 * Releases a live hold the merchant will never capture (POST /admin/authorizations/:id/release).
 * Money moves back to the customer's available credit, so the request carries a client-generated
 * Idempotency-Key that survives a retry after a timeout (MO2), bound to the hold.
 */
export function releaseHold(authorizationId: string): Promise<Authorization> {
  return withIdempotencyKey(
    { action: 'admin.authorization.release', payload: { authorizationId } },
    (idempotencyKey) =>
      apiRequest({
        path: ENDPOINTS.admin.releaseHold(authorizationId),
        method: 'POST',
        schema: authorizationSchema,
        idempotencyKey,
      }),
  );
}
