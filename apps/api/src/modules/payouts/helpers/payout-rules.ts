import type { ProviderPayment } from '@acme/contracts';

/** Provider attempts per payout; after the last one fails the payout is FAILED and reported. */
export const MAX_PAYOUT_ATTEMPTS = 5;

/** A claimed payout is invisible to other workers this long; a crash makes it due again. */
export const PAYOUT_CLAIM_LEASE_MS = 60_000;

const FIRST_RETRY_MS = 30_000;
const MAX_RETRY_MS = 60 * 60_000;

/** After the n-th failed attempt: 30 s, 1 min, 2 min … capped at 1 h. */
export function payoutRetryDelayMs(failedAttempts: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** (failedAttempts - 1), MAX_RETRY_MS);
}

export type PayoutOutcome = 'sent' | 'retry' | 'failed' | 'wait';

/**
 * What the provider's answer about the CURRENT attempt means. PENDING is no answer: the same
 * reference is asked again (MO4). Only a FAILED attempt moves on, to a new reference, until the
 * attempts run out.
 */
export function payoutOutcome(status: ProviderPayment['status'], attempts: number): PayoutOutcome {
  if (status === 'SUCCEEDED') return 'sent';
  if (status === 'PENDING') return 'wait';
  return attempts >= MAX_PAYOUT_ATTEMPTS ? 'failed' : 'retry';
}
