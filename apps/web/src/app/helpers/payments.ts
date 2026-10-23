import type { PaymentStatus } from '@acme/contracts';

/** What a deposit and a repayment share: both wait for the customer's approval at the bank. */
export interface TrackedPayment {
  id: string;
  amountCents: string;
  status: PaymentStatus;
  checkout: { paymentId: string; approveUrl: string };
  createdAt: string;
}

/** How long the app keeps polling a pending transfer before asking the customer to check again. */
export const PAYMENT_WATCH_MS = 2 * 60 * 1000;
export const PAYMENT_POLL_MS = 3000;

/** The newest transfer still waiting for the bank, if any (lists are newest first). */
export function latestPending<T extends TrackedPayment>(items: readonly T[] | undefined): T | null {
  return items?.find((item) => item.status === 'PENDING') ?? null;
}

/**
 * The poll interval of a transfer list (W3: every poll has a stop condition): poll while one is
 * pending and the watch window is open; stop once it is decided or the window closed.
 */
export function paymentPollInterval(
  items: readonly TrackedPayment[] | undefined,
  watchUntil: number,
  now: number,
): number | false {
  return latestPending(items) && now < watchUntil ? PAYMENT_POLL_MS : false;
}

/** True when a transfer that was pending in `previous` is decided in `next` (balances changed). */
export function settledSince(
  previous: readonly TrackedPayment[] | undefined,
  next: readonly TrackedPayment[],
): boolean {
  const wasPending = new Set(
    (previous ?? []).filter((item) => item.status === 'PENDING').map((item) => item.id),
  );
  return next.some((item) => wasPending.has(item.id) && item.status !== 'PENDING');
}

/**
 * The bank's approval page comes from our API, but a link is only rendered for http(s) URLs: a
 * `javascript:` or `data:` URL never becomes clickable, whatever the payload says (W14).
 */
export function safeApproveUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : null;
  } catch {
    // Not a URL at all: no link.
    return null;
  }
}
