import { AppHttpException } from '@acme/nest-core';
import { randomBytes, randomInt } from 'node:crypto';
import type { AccountStatus, ActorType, FreezeActor } from '../../../generated/prisma/client';
import { minCents, type Cents } from '../../../core/money/money';

export const CARD_VALIDITY_YEARS = 4;
const CARD_TOKEN_PREFIX = 'card_';
/** 18 random bytes → 24 base64url characters. */
const CARD_TOKEN_BYTES = 18;

export interface IssuedCard {
  cardLast4: string;
  cardToken: string;
  cardExpiresOn: Date;
}

/** A new card: random last 4, an unguessable network token, valid for 4 years (month-end). */
export function issueCard(now: Date): IssuedCard {
  return {
    cardLast4: String(randomInt(0, 10_000)).padStart(4, '0'),
    cardToken: `${CARD_TOKEN_PREFIX}${randomBytes(CARD_TOKEN_BYTES).toString('base64url')}`,
    cardExpiresOn: new Date(
      Date.UTC(now.getUTCFullYear() + CARD_VALIDITY_YEARS, now.getUTCMonth(), 1),
    ),
  };
}

/** A card is usable through the last day of its expiry month. */
export function isCardExpired(expiresOn: Date, now: Date): boolean {
  const firstDayAfter = Date.UTC(expiresOn.getUTCFullYear(), expiresOn.getUTCMonth() + 1, 1);
  return now.getTime() >= firstDayAfter;
}

export interface FreezeState {
  status: AccountStatus;
  frozenBy: FreezeActor | null;
}

/** Only an admin freezes as ADMIN; the customer's own door freezes as CUSTOMER. */
export function freezeActorOf(actorType: ActorType): FreezeActor {
  return actorType === 'admin' ? 'ADMIN' : 'CUSTOMER';
}

/**
 * Freeze needs an ACTIVE account; a closed one says so. An admin may also take over a freeze the
 * customer placed, so the customer can no longer lift it.
 */
export function assertCanFreeze(account: FreezeState, by: FreezeActor): void {
  if (account.status === 'CLOSED') throw new AppHttpException('account.closed');
  const adminTakesOver =
    account.status === 'FROZEN' && account.frozenBy === 'CUSTOMER' && by === 'ADMIN';
  if (account.status !== 'ACTIVE' && !adminTakesOver) {
    throw new AppHttpException('account.not_active');
  }
}

/** Only a FROZEN account is unfrozen, and an admin's freeze only by an admin. */
export function assertCanUnfreeze(account: FreezeState, by: FreezeActor): void {
  if (account.status === 'CLOSED') throw new AppHttpException('account.closed');
  if (account.status !== 'FROZEN') throw new AppHttpException('account.not_frozen');
  if (account.frozenBy === 'ADMIN' && by !== 'ADMIN') {
    throw new AppHttpException('account.frozen_by_admin');
  }
}

export interface Settlement {
  collateralCents: Cents;
  appliedToDebtCents: Cents;
  releasedCents: Cents;
}

/**
 * Closing (R-05): the collateral pays the debt first; whatever is left goes back to the
 * customer. Holds must be settled first: a hold can still turn into debt.
 */
export function settleOnClose(account: {
  status: AccountStatus;
  collateralCents: Cents;
  heldCents: Cents;
  postedDebtCents: Cents;
}): Settlement {
  if (account.status === 'CLOSED') throw new AppHttpException('account.closed');
  if (account.heldCents > 0n) throw new AppHttpException('account.pending_holds');
  const applied = minCents(account.postedDebtCents, account.collateralCents);
  return {
    collateralCents: account.collateralCents,
    appliedToDebtCents: applied,
    releasedCents: account.collateralCents - applied,
  };
}
