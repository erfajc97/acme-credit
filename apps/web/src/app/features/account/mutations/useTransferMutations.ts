import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatAmount } from '@/app/helpers/money';
import { sonnerResponse } from '@/app/helpers/sonnerResponse';
import { toastApiError } from '@/app/helpers/toastApiError';
import { validationParams } from '@/app/helpers/validationParams';
import { t } from '@/app/i18n';
import { DEPOSITS_KEY, REPAYMENTS_KEY } from '@/app/tanstack-queries/paymentsQuery';
import { createDeposit, createRepayment } from '../services/accountService';

/** Requests a security deposit; the customer then approves it at the bank (simulator). */
export function useDepositMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDeposit,
    onSuccess: (deposit) => {
      sonnerResponse(
        t('deposit.toast.requested', { amount: formatAmount(deposit.amountCents) }),
        'success',
      );
      return queryClient.invalidateQueries({ queryKey: [DEPOSITS_KEY] });
    },
    onError: (error) => toastApiError(error, 'deposit.toast.failed', validationParams()),
  });
}

/** Requests a payment of what is owed; approved at the bank (simulator) like a deposit. */
export function useRepaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRepayment,
    onSuccess: (repayment) => {
      sonnerResponse(
        t('payment.toast.requested', { amount: formatAmount(repayment.amountCents) }),
        'success',
      );
      return queryClient.invalidateQueries({ queryKey: [REPAYMENTS_KEY] });
    },
    onError: (error) => toastApiError(error, 'payment.toast.failed'),
  });
}
