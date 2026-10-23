import { checkoutResultSchema, type CheckoutRequest, type CheckoutResult } from '@acme/contracts';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';
import { withIdempotencyKey } from '@/app/lib/idempotency';

/**
 * POST {network}/v1/checkout: the card network (acting as the merchant) prices the SKUs from the
 * catalog and asks the core for one authorization. The browser sends SKUs and quantities only,
 * never a price. The key is persisted before the request leaves and reused on a retry of the same
 * cart after a timeout, so one order is never authorized twice (MO2).
 */
export function submitCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  return withIdempotencyKey({ action: 'checkout.create', payload: request }, (idempotencyKey) =>
    apiRequest({
      target: 'network',
      path: ENDPOINTS.network.checkout,
      method: 'POST',
      body: request,
      schema: checkoutResultSchema,
      idempotencyKey,
    }),
  );
}
