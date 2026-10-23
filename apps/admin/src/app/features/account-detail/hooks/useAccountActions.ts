import { ADMIN_FREEZE_REASONS, type AdminAccount } from '@acme/contracts';
import { useState } from 'react';
import { formatAmount } from '@/app/helpers/money';
import { FREEZE_REASON } from '@/app/helpers/statusLabels';
import { getActiveLocale, t } from '@/app/i18n';
import {
  actionAvailability,
  closePreview,
  DEFAULT_FREEZE_REASON,
  type AccountAction,
  type AdminFreezeReason,
} from '../helpers/accountActions';
import { useAccountActionMutation } from '../mutations/useAccountActionMutation';

export interface ActionButton {
  action: AccountAction;
  label: string;
  isDisabled: boolean;
}

/** The reason copy is written to sit inside a sentence ("reason: collections"); an option starts it. */
const asOption = (text: string) =>
  `${text.charAt(0).toLocaleUpperCase(getActiveLocale())}${text.slice(1)}`;

const isFreezeReason = (value: string): value is AdminFreezeReason =>
  (ADMIN_FREEZE_REASONS as readonly string[]).includes(value);

/** A card the customer froze: an admin freeze takes it over (only an admin can lift it then). */
const isTakeOver = (action: AccountAction, account: AdminAccount) =>
  action === 'freeze' && account.status === 'FROZEN';

/** The confirmation's sentence: what the action does to this customer's money, with amounts. */
function confirmationBody(action: AccountAction, account: AdminAccount): string {
  const name = account.customer.fullName;
  if (isTakeOver(action, account)) return t('accountDetail.freeze.takeOverBody', { name });
  if (action === 'freeze') {
    return t('accountDetail.freeze.body', {
      name,
      held: formatAmount(account.heldCents),
      owed: formatAmount(account.postedDebtCents),
    });
  }
  if (action === 'unfreeze') {
    return t('accountDetail.unfreeze.body', {
      name,
      available: formatAmount(account.availableCents),
    });
  }
  const preview = closePreview(account);
  return t(
    preview.appliedCents > 0n
      ? 'accountDetail.close.bodyWithDebt'
      : 'accountDetail.close.bodyNoDebt',
    {
      name,
      collateral: formatAmount(preview.collateralCents),
      owed: formatAmount(preview.appliedCents),
      released: formatAmount(preview.releasedCents),
    },
  );
}

/**
 * The account's actions: which are offered, the reason one is blocked (shown next to it, W5),
 * and the confirmation dialog, which closes only when the action succeeded.
 */
export function useAccountActions(account: AdminAccount) {
  const [pending, setPending] = useState<AccountAction | null>(null);
  const [freezeReason, setFreezeReason] = useState<AdminFreezeReason>(DEFAULT_FREEZE_REASON);
  const mutation = useAccountActionMutation();
  const availability = actionAvailability(account);
  const labelOf = (action: AccountAction) =>
    t(
      isTakeOver(action, account)
        ? 'accountDetail.freeze.takeOverAction'
        : `accountDetail.${action}.action`,
    );

  const buttons: ActionButton[] = availability.actions.map((action) => ({
    action,
    label: labelOf(action),
    isDisabled: action === 'close' && availability.isCloseBlocked,
  }));

  const confirm = () => {
    if (!pending) return;
    mutation.mutate(
      {
        action: pending,
        accountId: account.id,
        customerName: account.customer.fullName,
        ...(pending === 'freeze' ? { reason: freezeReason } : {}),
      },
      { onSuccess: () => setPending(null) },
    );
  };

  return {
    buttons,
    isClosed: account.status === 'CLOSED',
    blockedReason: availability.isCloseBlocked
      ? t('accountDetail.closeBlocked', { amount: formatAmount(account.heldCents) })
      : null,
    open: (action: AccountAction) => {
      setFreezeReason(DEFAULT_FREEZE_REASON);
      setPending(action);
    },
    // The freeze dialog asks why (optional: the default is a review); the API stores the reason.
    freezeReason: {
      value: freezeReason,
      options: ADMIN_FREEZE_REASONS.map((reason) => ({
        value: reason,
        label: asOption(t(FREEZE_REASON[reason])),
      })),
      onChange: (value: string) => {
        if (isFreezeReason(value)) setFreezeReason(value);
      },
    },
    dialog: pending
      ? {
          title: t(
            isTakeOver(pending, account)
              ? 'accountDetail.freeze.takeOverTitle'
              : `accountDetail.${pending}.title`,
          ),
          body: confirmationBody(pending, account),
          asksReason: pending === 'freeze',
          confirmLabel: labelOf(pending),
          pendingLabel: t(`accountDetail.${pending}.pending`),
          tone: pending === 'unfreeze' ? ('primary' as const) : ('danger' as const),
        }
      : null,
    onOpenChange: (isOpen: boolean) => {
      if (!isOpen && !mutation.isPending) setPending(null);
    },
    confirm,
    isPending: mutation.isPending,
  };
}
