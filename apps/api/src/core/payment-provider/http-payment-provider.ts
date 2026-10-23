import { AppHttpException, signRequest } from '@acme/nest-core';
import {
  providerPaymentSchema,
  type ProviderCreatePayment,
  type ProviderPayment,
} from '@acme/contracts';
import type { Env } from '../config/env';
import type { PaymentProvider } from './payment-provider.port';

export const PROVIDER_TIMEOUT_MS = 5_000;
const PAYMENTS_PATH = '/v1/provider/payments';

/**
 * HTTP adapter of the payment provider simulator (apps/card-network). Every call is signed
 * with PROVIDER_API_SECRET over the exact path and body (P3) and bounded by a 5 s timeout.
 * A timeout, a network error, a 5xx or an answer that is not a ProviderPayment is "unknown",
 * never "failed" (A9, MO4): it surfaces as 503 `payment.provider_unavailable` and nothing is
 * settled on it. A 4xx means the provider does not know or refuses the payment: 409
 * `payment.not_confirmed`, final for the caller.
 */
export class HttpPaymentProvider implements PaymentProvider {
  constructor(
    private readonly env: Env,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  createPayment(input: ProviderCreatePayment): Promise<ProviderPayment> {
    return this.call('POST', PAYMENTS_PATH, JSON.stringify(input));
  }

  getPayment(paymentId: string): Promise<ProviderPayment> {
    return this.call('GET', `${PAYMENTS_PATH}/${encodeURIComponent(paymentId)}`, '');
  }

  private async call(method: 'GET' | 'POST', path: string, body: string): Promise<ProviderPayment> {
    const headers = {
      ...signRequest(
        // No Idempotency-Key: the provider is idempotent by our reference, so an empty key is signed.
        { secret: this.env.PROVIDER_API_SECRET, method, path, idempotencyKey: '', rawBody: body },
        Math.floor(this.now() / 1000),
      ),
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    };
    let response: Response;
    let payload: unknown;
    try {
      response = await this.fetchFn(new URL(path, this.env.PROVIDER_API_URL), {
        method,
        headers,
        ...(method === 'POST' ? { body } : {}),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
      payload = await response.json();
    } catch (error) {
      throw new AppHttpException('payment.provider_unavailable', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
    if (response.status >= 400 && response.status < 500) {
      throw new AppHttpException('payment.not_confirmed', { status: response.status });
    }
    const parsed = providerPaymentSchema.safeParse(payload);
    if (!response.ok || !parsed.success) {
      throw new AppHttpException('payment.provider_unavailable', { status: response.status });
    }
    return parsed.data;
  }
}
