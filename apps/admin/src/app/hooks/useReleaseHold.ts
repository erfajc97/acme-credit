import { useState } from 'react';
import type { ReleaseTarget } from '@/app/helpers/holds';
import { t } from '@/app/i18n';
import { useReleaseHoldMutation } from '@/app/mutations/useReleaseHoldMutation';

/**
 * The "Release hold" confirmation shared by the purchases list and the account page: which hold
 * is being released, the sentence that names its money, and a dialog that closes only when the
 * release succeeded (W5).
 */
export function useReleaseHold() {
  const [target, setTarget] = useState<ReleaseTarget | null>(null);
  const mutation = useReleaseHoldMutation();
  return {
    open: (next: ReleaseTarget) => setTarget(next),
    dialog: target
      ? {
          title: t('releaseHold.title'),
          body: target.customerName
            ? t('releaseHold.body', {
                amount: target.amount,
                merchant: target.merchant,
                name: target.customerName,
              })
            : t('releaseHold.bodyNoCustomer', { amount: target.amount, merchant: target.merchant }),
        }
      : null,
    onOpenChange: (isOpen: boolean) => {
      if (!isOpen && !mutation.isPending) setTarget(null);
    },
    confirm: () => {
      if (target) mutation.mutate(target, { onSuccess: () => setTarget(null) });
    },
    isPending: mutation.isPending,
  };
}

export type ReleaseHoldView = ReturnType<typeof useReleaseHold>;
