import { ADMIN_FREEZE_REASONS, idSchema, type AdminAccount } from '@acme/contracts';

export type AccountAction = 'freeze' | 'unfreeze' | 'close';

/** Why an admin freezes a card (the API's ADMIN_FREEZE_REASONS); `admin_review` when unsure. */
export type AdminFreezeReason = (typeof ADMIN_FREEZE_REASONS)[number];
export const DEFAULT_FREEZE_REASON: AdminFreezeReason = 'admin_review';

/** The account the page shows: `?id=<uuid>`, or null for a missing or malformed id. */
export function accountIdFromSearch(search: string): string | null {
  const parsed = idSchema.safeParse(new URLSearchParams(search).get('id'));
  return parsed.success ? parsed.data : null;
}

export interface ActionAvailability {
  /** Actions the account's status allows, in the order they are offered. */
  actions: AccountAction[];
  /** Close is offered but blocked while purchases are on hold (the API answers pending_holds). */
  isCloseBlocked: boolean;
}

/**
 * What an admin may do to an account (a UX mirror of the API's status rules, which decide):
 * freeze an active card, unfreeze a frozen one, close anything not closed yet. A freeze the
 * customer placed can also be taken over by an admin, so the customer can no longer lift it.
 */
export function actionAvailability(
  account: Pick<AdminAccount, 'status' | 'heldCents' | 'frozenBy'>,
): ActionAvailability {
  const byStatus: Record<AdminAccount['status'], AccountAction[]> = {
    PENDING_COLLATERAL: ['close'],
    ACTIVE: ['freeze', 'close'],
    FROZEN:
      account.frozenBy === 'CUSTOMER' ? ['unfreeze', 'freeze', 'close'] : ['unfreeze', 'close'],
    CLOSED: [],
  };
  const actions = byStatus[account.status];
  return { actions, isCloseBlocked: actions.includes('close') && BigInt(account.heldCents) > 0n };
}

export interface ClosePreview {
  collateralCents: bigint;
  /** Collateral applied to what is owed: the smaller of the two. */
  appliedCents: bigint;
  /** What goes back to the customer. */
  releasedCents: bigint;
}

/** What closing does to the collateral (ADR-0002: debt is paid from the collateral first). */
export function closePreview(
  account: Pick<AdminAccount, 'collateralCents' | 'postedDebtCents'>,
): ClosePreview {
  const collateralCents = BigInt(account.collateralCents);
  const owed = BigInt(account.postedDebtCents);
  const appliedCents = owed < collateralCents ? owed : collateralCents;
  return { collateralCents, appliedCents, releasedCents: collateralCents - appliedCents };
}
