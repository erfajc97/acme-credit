import { linesTotalCents, type OrderLine } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import type {
  AccountStatus,
  AuthorizationStatus,
  DeclineReason,
  ReversalReason,
} from '../../../generated/prisma/client';
import { availableCredit, type Cents } from '../../../core/money/money';
import { isCardExpired } from '../../accounts/helpers/account-rules';

export interface CardAccount {
  status: AccountStatus;
  cardExpiresOn: Date | null;
  creditLimitCents: Cents;
  heldCents: Cents;
  postedDebtCents: Cents;
}

/**
 * The authorization decision (R-03), taken under the account row lock. Order matters and is
 * the one the network shows the customer: unknown or expired card, frozen card, account not
 * active, then the money. Approval needs `amount <= available` — exactly the available amount
 * is approved, one cent more is not.
 */
export function declineReasonFor(
  account: CardAccount | null,
  amount: Cents,
  now: Date,
): DeclineReason | null {
  if (!account || !account.cardExpiresOn || isCardExpired(account.cardExpiresOn, now)) {
    return 'invalid_card';
  }
  if (account.status === 'FROZEN') return 'card_frozen';
  if (account.status !== 'ACTIVE') return 'account_not_active';
  if (amount > availableCredit(account)) return 'insufficient_funds';
  return null;
}

export interface HoldState {
  status: AuthorizationStatus;
  amountCents: Cents;
  expiresAt: Date | null;
  reversalReason: ReversalReason | null;
}

/** When an approved hold nobody captured is released: HOLD_TTL_HOURS after the approval (MO5). */
export function holdExpiresAt(approvedAt: Date, ttlHours: number): Date {
  return new Date(approvedAt.getTime() + ttlHours * 3_600_000);
}

/** A hold is expired from its expiry instant on; the sweep and the capture agree on it. */
export function isHoldExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && now.getTime() >= expiresAt.getTime();
}

/**
 * Only a live hold is captured, for at most what was authorized (partial captures happen). A
 * hold that expired or that an admin released says so, even before the sweep got to it.
 */
export function assertCapturable(authorization: HoldState, capture: Cents, now: Date): void {
  const released = authorization.reversalReason;
  if (authorization.status === 'REVERSED' && released && released !== 'network') {
    throw new AppHttpException('authorization.hold_released', { reason: released });
  }
  if (authorization.status !== 'APPROVED')
    throw new AppHttpException('authorization.not_capturable');
  if (isHoldExpired(authorization.expiresAt, now)) {
    throw new AppHttpException('authorization.hold_released', { reason: 'expired' });
  }
  if (capture > authorization.amountCents) {
    throw new AppHttpException('authorization.capture_exceeds_hold');
  }
}

export function assertReversible(authorization: { status: AuthorizationStatus }): void {
  if (authorization.status !== 'APPROVED')
    throw new AppHttpException('authorization.not_reversible');
}

/**
 * A store purchase carries its priced lines; they must total the authorized amount exactly.
 * Checked before anything is written (no idempotency record, no hold, no stored decision).
 */
export function assertLinesMatchAmount(
  items: readonly OrderLine[] | undefined,
  amount: Cents,
): void {
  if (items && linesTotalCents(items) !== amount) {
    throw new AppHttpException('common.validation_failed', { reason: 'items_total_mismatch' });
  }
}
