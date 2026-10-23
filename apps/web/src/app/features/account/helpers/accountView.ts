import type { Account } from '@acme/contracts';
import type { AccountView, SettlementSummary } from '../types';

export function accountViewOf(account: Account | null): AccountView {
  if (!account) return 'none';
  if (account.status === 'PENDING_COLLATERAL') return 'pendingCollateral';
  if (account.status === 'CLOSED') return 'closed';
  return 'open';
}

interface ActivityLike {
  type: string;
  amountCents: string;
}

/**
 * The close settlement as the ledger recorded it: the deposit applied to debt plus the deposit
 * returned. Null when the activity has neither line (nothing to summarise).
 */
export function settlementFromActivity(items: readonly ActivityLike[]): SettlementSummary | null {
  let applied = 0n;
  let released = 0n;
  let found = false;
  for (const item of items) {
    if (item.type === 'collateral_applied') {
      applied += BigInt(item.amountCents);
      found = true;
    } else if (item.type === 'collateral_released') {
      released += BigInt(item.amountCents);
      found = true;
    }
  }
  if (!found) return null;
  return {
    collateralCents: applied + released,
    appliedToDebtCents: applied,
    releasedCents: released,
  };
}
