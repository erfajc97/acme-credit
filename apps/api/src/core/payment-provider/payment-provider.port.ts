import type { ProviderCreatePayment, ProviderPayment } from '@acme/contracts';

/** The payment provider (A9): adapters implement it; tests point it at a fake server. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProvider {
  /** Idempotent by `reference`: calling again with the same reference returns the same payment. */
  createPayment(input: ProviderCreatePayment): Promise<ProviderPayment>;
  getPayment(paymentId: string): Promise<ProviderPayment>;
}
