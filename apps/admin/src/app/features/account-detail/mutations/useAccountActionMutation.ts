import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatAmount } from '@/app/helpers/money';
import { sonnerResponse } from '@/app/helpers/sonnerResponse';
import { toastApiError } from '@/app/helpers/toastApiError';
import { t } from '@/app/i18n';
import {
  ACCOUNT_KEY,
  ACCOUNTS_KEY,
  AUDIT_LOG_KEY,
  DASHBOARD_KEY,
  JOURNAL_KEY,
} from '@/app/tanstack-queries/adminQueries';
import {
  DEFAULT_FREEZE_REASON,
  type AccountAction,
  type AdminFreezeReason,
} from '../helpers/accountActions';
import { closeAccount, freezeAccount, unfreezeAccount } from '../services/accountActionsService';

export interface AccountActionInput {
  action: AccountAction;
  accountId: string;
  /** The customer's name, for the toast (docs/brand.md: name the account). */
  customerName: string;
  /** Why the card is frozen (freeze only). */
  reason?: AdminFreezeReason;
}

/** Runs the action; resolves with the amount returned to the customer when the account closes. */
async function runAction({
  action,
  accountId,
  reason,
}: AccountActionInput): Promise<string | null> {
  if (action === 'freeze') await freezeAccount(accountId, reason ?? DEFAULT_FREEZE_REASON);
  else if (action === 'unfreeze') await unfreezeAccount(accountId);
  else return formatAmount((await closeAccount(accountId)).settlement.releasedCents);
  return null;
}

/**
 * Freeze, unfreeze or close (W5, W6): a success toast naming the customer, every view that shows
 * the account's status or balances invalidated by its key, and errors by code.
 */
export function useAccountActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runAction,
    onSuccess: (released, { action, customerName }) => {
      sonnerResponse(
        t(`accountDetail.${action}.done`, { name: customerName, released: released ?? '' }),
        'success',
      );
      const keys = [ACCOUNT_KEY, ACCOUNTS_KEY, DASHBOARD_KEY, AUDIT_LOG_KEY];
      // Closing posts the collateral's journal entries; freezing moves no money.
      if (action === 'close') keys.push(JOURNAL_KEY);
      return Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
    onError: (error, { action }) => toastApiError(error, `accountDetail.${action}.failed`),
  });
}
