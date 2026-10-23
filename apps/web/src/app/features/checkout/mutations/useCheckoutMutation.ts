import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toastApiError } from '@/app/helpers/toastApiError';
import { ACCOUNT_KEY } from '@/app/tanstack-queries/accountQuery';
import { ACTIVITY_KEY } from '@/app/tanstack-queries/activityQuery';
import { AUTHORIZATIONS_KEY } from '@/app/tanstack-queries/authorizationsQuery';
import { submitCheckout } from '../services/checkoutService';

/**
 * Pays the cart. Approved and declined are both answers (2xx) shown in the page; only a failure
 * to get an answer is a toast. Either answer moves the balances and the order list, which are
 * refetched before the result shows, so "available now" is the refreshed figure.
 */
export function useCheckoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitCheckout,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [ACCOUNT_KEY] }),
        queryClient.invalidateQueries({ queryKey: [AUTHORIZATIONS_KEY] }),
        queryClient.invalidateQueries({ queryKey: [ACTIVITY_KEY] }),
      ]),
    onError: (error) => toastApiError(error, 'checkout.toast.failed'),
  });
}
