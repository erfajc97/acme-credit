import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sonnerResponse } from '@/app/helpers/sonnerResponse';
import { toastApiError } from '@/app/helpers/toastApiError';
import { t } from '@/app/i18n';
import { ACCOUNT_KEY } from '@/app/tanstack-queries/accountQuery';
import { freezeAccount, openAccount, unfreezeAccount } from '../services/accountService';

export function useOpenAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: openAccount,
    onSuccess: () => {
      sonnerResponse(t('account.toast.opened'), 'success');
      return queryClient.invalidateQueries({ queryKey: [ACCOUNT_KEY] });
    },
    onError: (error) => toastApiError(error, 'account.toast.openFailed'),
  });
}

export function useFreezeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: freezeAccount,
    onSuccess: () => {
      sonnerResponse(t('account.toast.frozen'), 'success');
      return queryClient.invalidateQueries({ queryKey: [ACCOUNT_KEY] });
    },
    onError: (error) => toastApiError(error, 'account.toast.freezeFailed'),
  });
}

export function useUnfreezeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unfreezeAccount,
    onSuccess: () => {
      sonnerResponse(t('account.toast.unfrozen'), 'success');
      return queryClient.invalidateQueries({ queryKey: [ACCOUNT_KEY] });
    },
    onError: (error) => toastApiError(error, 'account.toast.unfreezeFailed'),
  });
}
