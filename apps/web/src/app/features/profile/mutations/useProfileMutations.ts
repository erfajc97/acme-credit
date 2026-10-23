import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatAmount } from '@/app/helpers/money';
import { sonnerResponse } from '@/app/helpers/sonnerResponse';
import { toastApiError } from '@/app/helpers/toastApiError';
import { t } from '@/app/i18n';
import { useAuthStore } from '@/app/store/authStore';
import { useCartStore } from '@/app/store/cartStore';
import { ACCOUNT_KEY } from '@/app/tanstack-queries/accountQuery';
import { ACTIVITY_KEY } from '@/app/tanstack-queries/activityQuery';
import { SESSION_KEY } from '@/app/tanstack-queries/sessionQuery';
import { closeAccount, signOut } from '../services/profileService';

export function useSignOutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // The session gate of the page sees it ended and sends the customer to sign in.
      useAuthStore.getState().clearSession({ byUser: true });
      useCartStore.getState().clear();
      // Drop every cached private response before leaving (nothing of this customer stays), and
      // record the bootstrap's answer as "no session" so the still-mounted gate does not ask the
      // API again before the page changes.
      queryClient.clear();
      queryClient.setQueryData([SESSION_KEY], null);
    },
    onError: (error) => toastApiError(error, 'session.signOutFailed'),
  });
}

export function useCloseAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: closeAccount,
    onSuccess: ({ settlement }) => {
      sonnerResponse(
        t('close.toast.closed', { amount: formatAmount(settlement.releasedCents) }),
        'success',
      );
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: [ACCOUNT_KEY] }),
        queryClient.invalidateQueries({ queryKey: [ACTIVITY_KEY] }),
      ]);
    },
    onError: (error) => toastApiError(error, 'close.toast.failed'),
  });
}
