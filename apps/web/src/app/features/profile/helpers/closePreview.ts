import type { Account } from '@acme/contracts';
import type { ClosePreview } from '../types';

/**
 * What closing would do (docs/plan.md §3 › close): what is owed is paid from the security deposit
 * first, the rest is returned. Holds block the close until they post or are cancelled.
 */
export function closePreviewOf(account: Account): ClosePreview {
  const collateralCents = BigInt(account.collateralCents);
  const owedCents = BigInt(account.postedDebtCents);
  const appliedToDebtCents = owedCents < collateralCents ? owedCents : collateralCents;
  return {
    collateralCents,
    appliedToDebtCents,
    returnedCents: collateralCents - appliedToDebtCents,
    heldCents: BigInt(account.heldCents),
  };
}
