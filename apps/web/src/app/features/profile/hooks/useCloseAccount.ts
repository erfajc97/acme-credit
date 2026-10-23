import type { Account } from '@acme/contracts';
import { formatAmount } from '@/app/helpers/money';
import { closePreviewOf } from '../helpers/closePreview';
import { useCloseAccountMutation } from '../mutations/useProfileMutations';

/** The close confirmation: what happens to the deposit, and the close itself. */
export function useCloseAccount(account: Account, onClosed: () => void) {
  const mutation = useCloseAccountMutation();
  const preview = closePreviewOf(account);
  const hasHolds = preview.heldCents > 0n;
  return {
    amounts: {
      collateral: formatAmount(preview.collateralCents),
      applied: formatAmount(preview.appliedToDebtCents),
      returned: formatAmount(preview.returnedCents),
      held: formatAmount(preview.heldCents),
    },
    bodyKey: preview.appliedToDebtCents > 0n ? 'close.bodyWithDebt' : 'close.bodyNoDebt',
    hasHolds,
    confirm: () => mutation.mutate(account.id, { onSuccess: onClosed }),
    isPending: mutation.isPending,
  };
}
