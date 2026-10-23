import { useEffect, useState } from 'react';
import { latestPending, PAYMENT_WATCH_MS, type TrackedPayment } from '@/app/helpers/payments';
import { usePaymentsQuery, type PaymentKind } from '@/app/tanstack-queries/paymentsQuery';

export type WatchState = 'idle' | 'pending' | 'timedOut' | 'confirmed' | 'failed';

/**
 * Follows the transfer the customer must approve at the bank: the one just requested, or the
 * newest still pending (after a reload). Polls for up to two minutes (W3), then asks the
 * customer to check again instead of polling forever.
 */
export function usePaymentWatch(kind: PaymentKind, accountId: string) {
  const [watchUntil, setWatchUntil] = useState(() => Date.now() + PAYMENT_WATCH_MS);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const query = usePaymentsQuery({ kind, accountId, watchUntil });

  const items = query.data;
  const tracked: TrackedPayment | null =
    items?.find((item) => item.id === trackedId) ?? latestPending(items);
  const isPending = tracked?.status === 'PENDING';

  useEffect(() => {
    // A timer is the external system synced here: it re-renders once the watch window closes,
    // so the screen switches from "waiting" to "check again". The poll itself is TanStack's.
    if (!isPending) return undefined;
    const timer = window.setTimeout(
      () => setCheckedAt(Date.now()),
      Math.max(watchUntil - Date.now(), 0),
    );
    return () => window.clearTimeout(timer);
  }, [isPending, watchUntil]);

  const extendWatch = () => {
    const now = Date.now();
    setWatchUntil(now + PAYMENT_WATCH_MS);
    setCheckedAt(now);
  };

  let state: WatchState = 'idle';
  if (tracked?.status === 'CONFIRMED') state = 'confirmed';
  else if (tracked?.status === 'FAILED') state = 'failed';
  else if (tracked) state = checkedAt >= watchUntil ? 'timedOut' : 'pending';

  return {
    state,
    tracked,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefreshing: query.isFetching,
    // refetch never rejects: a failure lands in the query state, shown by the error branch.
    retry: () => void query.refetch(),
    /** Starts following a transfer the customer just requested. */
    track: (paymentId: string) => {
      setTrackedId(paymentId);
      extendWatch();
    },
    checkAgain: () => {
      extendWatch();
      void query.refetch();
    },
    /** Back to the form after a confirmed or failed transfer. */
    reset: () => setTrackedId(null),
  };
}
