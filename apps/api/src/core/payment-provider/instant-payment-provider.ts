import type { ProviderCreatePayment, ProviderPayment } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import type { PaymentProvider } from './payment-provider.port';

/**
 * An in-process provider for the demo seed only (never wired into the API or the worker): it
 * behaves like the simulator — idempotent by reference, payments PENDING until approved,
 * payouts settled at once — so the seed drives the REAL services and the real settlement path
 * without a network. `approve` is the customer clicking "pay" at the bank.
 */
export class InstantPaymentProvider implements PaymentProvider {
  private readonly byReference = new Map<string, ProviderPayment>();

  constructor(
    private readonly baseUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createPayment(input: ProviderCreatePayment): Promise<ProviderPayment> {
    const existing = this.byReference.get(input.reference);
    if (existing) return existing;
    const id = `seed_${input.reference}`;
    const payout = input.purpose === 'payout';
    const at = this.now().toISOString();
    const payment: ProviderPayment = {
      id,
      reference: input.reference,
      amountCents: input.amountCents,
      purpose: input.purpose,
      status: payout ? 'SUCCEEDED' : 'PENDING',
      approveUrl: new URL(`/provider/pay/${id}`, this.baseUrl).toString(),
      createdAt: at,
      settledAt: payout ? at : null,
    };
    this.byReference.set(input.reference, payment);
    return payment;
  }

  async getPayment(paymentId: string): Promise<ProviderPayment> {
    const payment = [...this.byReference.values()].find((item) => item.id === paymentId);
    if (!payment) throw new AppHttpException('payment.not_confirmed', { status: 404 });
    return payment;
  }

  /** The customer approves the transfer; returns the provider's payment id. */
  approve(reference: string): string {
    const payment = this.byReference.get(reference);
    if (!payment) throw new Error(`no seed payment for ${reference}`);
    this.byReference.set(reference, {
      ...payment,
      status: 'SUCCEEDED',
      settledAt: this.now().toISOString(),
    });
    return payment.id;
  }
}
