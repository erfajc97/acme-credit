import type { VoidPurchaseRequest } from '@acme/contracts';
import { z } from 'zod';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';
import { withIdempotencyKey } from '@/app/lib/idempotency';

/**
 * Cancels (voids) an order still on hold at the card network. Only the status matters (the lists
 * are refetched), so the answer is not interpreted. The card that made the purchase goes in the
 * body: the network voids nothing for an id alone. Keyed like every money write (MO2).
 */
export function voidOrder(authorizationId: string, request: VoidPurchaseRequest): Promise<unknown> {
  return withIdempotencyKey(
    { action: 'purchase.void', payload: { authorizationId } },
    (idempotencyKey) =>
      apiRequest({
        target: 'network',
        path: ENDPOINTS.network.voidPurchase(authorizationId),
        method: 'POST',
        body: request,
        schema: z.unknown(),
        idempotencyKey,
      }),
  );
}
