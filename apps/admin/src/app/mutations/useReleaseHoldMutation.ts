import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReleaseTarget } from '@/app/helpers/holds';
import { sonnerResponse } from '@/app/helpers/sonnerResponse';
import { toastApiError } from '@/app/helpers/toastApiError';
import { t } from '@/app/i18n';
import { releaseHold } from '@/app/services/holdsService';
import {
  ACCOUNT_KEY,
  ACCOUNTS_KEY,
  AUDIT_LOG_KEY,
  AUTHORIZATIONS_KEY,
  DASHBOARD_KEY,
  PURCHASES_KEY,
} from '@/app/tanstack-queries/adminQueries';

/**
 * "Release hold" (W5, W6): a success toast naming the amount and the merchant, every view that
 * shows the hold or the account's held / available money invalidated by its key, errors by code.
 * Releasing posts no journal entry (nothing was captured), so the ledger is left alone.
 */
export function useReleaseHoldMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: ReleaseTarget) => releaseHold(target.authorizationId),
    onSuccess: (_hold, target) => {
      sonnerResponse(
        t('releaseHold.done', { amount: target.amount, merchant: target.merchant }),
        'success',
      );
      const keys = [
        PURCHASES_KEY,
        AUTHORIZATIONS_KEY,
        ACCOUNT_KEY,
        ACCOUNTS_KEY,
        DASHBOARD_KEY,
        AUDIT_LOG_KEY,
      ];
      return Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
    onError: (error) => toastApiError(error, 'releaseHold.failed'),
  });
}
