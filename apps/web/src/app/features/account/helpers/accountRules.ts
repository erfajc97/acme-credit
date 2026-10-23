import { MAX_ACCOUNT_COLLATERAL_CENTS, MIN_DEPOSIT_CENTS, type Account } from '@acme/contracts';

/**
 * How much more security deposit this account can take: the shared cap minus what is confirmed
 * (the API also counts deposits still in flight, and answers `payment.deposit_cap_exceeded` when a
 * new one would cross it). A deposit is possible while the room still fits the minimum deposit.
 */
export function depositRoomOf(collateralCents: string): { roomCents: bigint; canDeposit: boolean } {
  const left = MAX_ACCOUNT_COLLATERAL_CENTS - BigInt(collateralCents);
  const roomCents = left > 0n ? left : 0n;
  return { roomCents, canDeposit: roomCents >= MIN_DEPOSIT_CENTS };
}

/**
 * The card's freeze switch. A freeze by Acme Credit (`frozenBy: 'ADMIN'`) can only be lifted by our
 * team: the page explains it and offers no switch (the API refuses with `account.frozen_by_admin`).
 */
export function freezeControlOf(account: Pick<Account, 'status' | 'frozenBy'>) {
  const isFrozen = account.status === 'FROZEN';
  const isFrozenByAdmin = isFrozen && account.frozenBy === 'ADMIN';
  return { isFrozen, isFrozenByAdmin, canToggle: !isFrozenByAdmin };
}
