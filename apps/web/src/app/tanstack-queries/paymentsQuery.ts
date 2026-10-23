import { useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentPollInterval, settledSince, type TrackedPayment } from '@/app/helpers/payments';
import { fetchDeposits, fetchRepayments } from '@/app/services/accountsApi';
import { ACCOUNT_KEY } from './accountQuery';
import { ACTIVITY_KEY } from './activityQuery';

export const DEPOSITS_KEY = 'deposits';
export const REPAYMENTS_KEY = 'repayments';

export type PaymentKind = 'deposit' | 'repayment';

const KEY: Record<PaymentKind, string> = { deposit: DEPOSITS_KEY, repayment: REPAYMENTS_KEY };

async function fetchPayments(kind: PaymentKind, accountId: string): Promise<TrackedPayment[]> {
  const page =
    kind === 'deposit' ? await fetchDeposits(accountId) : await fetchRepayments(accountId);
  return page.items;
}

interface PaymentsQueryOptions {
  kind: PaymentKind;
  accountId: string | undefined;
  /** Epoch ms until which a pending transfer is polled (W3 stop condition). */
  watchUntil: number;
}

/**
 * The customer's deposits or repayments, newest first, polled while one waits for the bank. When
 * a poll sees a transfer decided, the balances changed: the account and activity are refreshed
 * from here (the query function, not an effect: W3).
 */
export function usePaymentsQuery({ kind, accountId, watchUntil }: PaymentsQueryOptions) {
  const queryClient = useQueryClient();
  const queryKey = [KEY[kind], accountId];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const previous = queryClient.getQueryData<TrackedPayment[]>(queryKey);
      const next = await fetchPayments(kind, accountId ?? '');
      if (settledSince(previous, next)) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [ACCOUNT_KEY] }),
          queryClient.invalidateQueries({ queryKey: [ACTIVITY_KEY] }),
        ]);
      }
      return next;
    },
    enabled: Boolean(accountId),
    refetchInterval: (query) => paymentPollInterval(query.state.data, watchUntil, Date.now()),
  });
}
