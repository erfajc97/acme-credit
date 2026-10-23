import type { Authorization } from '@acme/contracts';
import { formatAmount } from './money';
import { formatDateTime } from './dates';
import { REVERSAL_REASON } from './statusLabels';

/** A hold that expires within this window is "expiring soon" on the dashboard and in the lists. */
export const HOLD_EXPIRY_WARNING_MS = 24 * 60 * 60 * 1000;

type HoldFields = Pick<Authorization, 'status' | 'expiresAt' | 'reversalReason'>;

/**
 * A live hold: approved and not yet captured or released. Only these can be released by an admin
 * (a UX mirror of the API's `assertReversible`, which decides and answers `not_reversible`).
 */
export function isLiveHold(hold: Pick<Authorization, 'status'>): boolean {
  return hold.status === 'APPROVED';
}

/** A live hold whose expiry falls within the warning window (or already passed, not swept yet). */
export function isExpiringSoon(
  hold: Pick<Authorization, 'status' | 'expiresAt'>,
  now: number,
): boolean {
  if (!isLiveHold(hold) || hold.expiresAt === null) return false;
  return Date.parse(hold.expiresAt) - now <= HOLD_EXPIRY_WARNING_MS;
}

export interface HoldView {
  /** When a live hold is released on its own; null for anything else. */
  expires: string | null;
  expiresSoon: boolean;
  /** Why a released hold was released (i18n key); null unless it was. */
  reversalKey: string | null;
  canRelease: boolean;
}

/** The hold facts a purchase row shows next to its status. */
export function toHoldView(hold: HoldFields, now: number): HoldView {
  const live = isLiveHold(hold);
  return {
    expires: live && hold.expiresAt ? formatDateTime(hold.expiresAt) : null,
    expiresSoon: isExpiringSoon(hold, now),
    reversalKey: hold.reversalReason ? REVERSAL_REASON[hold.reversalReason] : null,
    canRelease: live,
  };
}

/** What the "Release hold" confirmation names: the money, where it was held and for whom. */
export interface ReleaseTarget {
  authorizationId: string;
  amount: string;
  merchant: string;
  customerName: string | null;
}

export function toReleaseTarget(
  hold: Pick<Authorization, 'id' | 'amountCents' | 'merchantName'>,
  customerName: string | null,
): ReleaseTarget {
  return {
    authorizationId: hold.id,
    amount: formatAmount(hold.amountCents),
    merchant: hold.merchantName,
    customerName,
  };
}
