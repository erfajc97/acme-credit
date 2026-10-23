import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sonnerResponse } from '@/app/helpers/sonnerResponse';
import { toastApiError } from '@/app/helpers/toastApiError';
import { t } from '@/app/i18n';
import { ACCOUNT_KEY } from '@/app/tanstack-queries/accountQuery';
import { ACTIVITY_KEY } from '@/app/tanstack-queries/activityQuery';
import { AUTHORIZATION_DETAIL_KEY } from '@/app/tanstack-queries/authorizationDetailQuery';
import { AUTHORIZATIONS_KEY } from '@/app/tanstack-queries/authorizationsQuery';
import { voidOrder } from '../services/ordersService';

interface VoidVariables {
  authorizationId: string;
  /** The account's card: the network only voids a hold for the card that made it. */
  cardToken: string;
  /** Formatted amount and merchant, for the confirmation copy. */
  amount: string;
  merchant: string;
}

/** Cancels an order on hold: the hold is released, so balances, orders and activity move. */
export function useVoidOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ authorizationId, cardToken }: VoidVariables) =>
      voidOrder(authorizationId, { cardToken }),
    onSuccess: (_result, { amount, merchant }) => {
      sonnerResponse(t('activity.orders.toast.voided', { amount, merchant }), 'success');
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: [ACCOUNT_KEY] }),
        queryClient.invalidateQueries({ queryKey: [AUTHORIZATIONS_KEY] }),
        queryClient.invalidateQueries({ queryKey: [AUTHORIZATION_DETAIL_KEY] }),
        queryClient.invalidateQueries({ queryKey: [ACTIVITY_KEY] }),
      ]);
    },
    onError: (error) => toastApiError(error, 'activity.orders.toast.voidFailed'),
  });
}
