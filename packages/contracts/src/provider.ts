import { z } from 'zod';
import { isoDateTimeSchema } from './common';
import { centsSchema } from './money';

/**
 * The simulated payment provider (lives in apps/card-network). The core creates payments
 * server-to-server, the customer approves them on the provider's page, the provider sends a
 * signed webhook, and the core re-reads the payment by OUR reference before crediting (MO4).
 */
export const PROVIDER_PAYMENT_PURPOSES = ['deposit', 'repayment', 'payout'] as const;
export const PROVIDER_PAYMENT_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;

export const providerCreatePaymentSchema = z
  .object({
    /** The core's own reference (deposit, repayment or payout id); unique per payment. */
    reference: z.string().min(1).max(64),
    amountCents: centsSchema,
    purpose: z.enum(PROVIDER_PAYMENT_PURPOSES),
  })
  .strict();

export const providerPaymentSchema = z
  .object({
    id: z.string(),
    reference: z.string(),
    amountCents: centsSchema,
    purpose: z.enum(PROVIDER_PAYMENT_PURPOSES),
    status: z.enum(PROVIDER_PAYMENT_STATUSES),
    approveUrl: z.url(),
    createdAt: isoDateTimeSchema,
    settledAt: isoDateTimeSchema.nullable(),
  })
  .strict();

/** Webhook body: only the ids; the core re-reads the state at the provider (MO4). */
export const providerWebhookSchema = z
  .object({ paymentId: z.string().min(1).max(64), reference: z.string().min(1).max(64) })
  .strict();

export type ProviderCreatePayment = z.infer<typeof providerCreatePaymentSchema>;
export type ProviderPayment = z.infer<typeof providerPaymentSchema>;
export type ProviderWebhook = z.infer<typeof providerWebhookSchema>;

/** Headers of every signed service-to-service call (P3). */
export const SIGNATURE_HEADER = 'X-Signature';
export const SIGNATURE_TIMESTAMP_HEADER = 'X-Signature-Timestamp';
export const SIGNATURE_MAX_SKEW_SECONDS = 300;
