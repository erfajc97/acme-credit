import { MAX_ACCOUNT_COLLATERAL_CENTS, MIN_DEPOSIT_CENTS } from '@acme/contracts';
import { accountFixture } from '@/test/fixtures';
import { depositRoomOf, freezeControlOf } from '../helpers/accountRules';

describe('depositRoomOf (one account holds at most MAX_ACCOUNT_COLLATERAL_CENTS)', () => {
  it('is the cap minus the confirmed deposit', () => {
    const room = depositRoomOf('250001');
    expect(room.roomCents).toBe(MAX_ACCOUNT_COLLATERAL_CENTS - 250_001n);
    expect(room.canDeposit).toBe(true);
  });

  it('never goes below zero, even if the stored deposit is above the cap (legacy data)', () => {
    expect(depositRoomOf((MAX_ACCOUNT_COLLATERAL_CENTS + 5n).toString()).roomCents).toBe(0n);
  });

  it('allows one more deposit while the room still fits the minimum deposit (boundary pair)', () => {
    const lastPassing = (MAX_ACCOUNT_COLLATERAL_CENTS - MIN_DEPOSIT_CENTS).toString();
    const firstFailing = (MAX_ACCOUNT_COLLATERAL_CENTS - MIN_DEPOSIT_CENTS + 1n).toString();
    expect(depositRoomOf(lastPassing).canDeposit).toBe(true);
    expect(depositRoomOf(firstFailing).canDeposit).toBe(false);
  });
});

describe('freezeControlOf (a customer cannot lift an admin freeze)', () => {
  it('an active card can be frozen by its owner', () => {
    expect(freezeControlOf(accountFixture({ status: 'ACTIVE', frozenBy: null }))).toEqual({
      isFrozen: false,
      isFrozenByAdmin: false,
      canToggle: true,
    });
  });

  it('a card the owner froze can be unfrozen by the owner', () => {
    expect(freezeControlOf(accountFixture({ status: 'FROZEN', frozenBy: 'CUSTOMER' }))).toEqual({
      isFrozen: true,
      isFrozenByAdmin: false,
      canToggle: true,
    });
  });

  it('a card Acme Credit froze shows why and offers no switch', () => {
    expect(freezeControlOf(accountFixture({ status: 'FROZEN', frozenBy: 'ADMIN' }))).toEqual({
      isFrozen: true,
      isFrozenByAdmin: true,
      canToggle: false,
    });
  });

  it('an unknown origin while frozen keeps the switch (the API still refuses an admin freeze by code)', () => {
    expect(freezeControlOf(accountFixture({ status: 'FROZEN', frozenBy: null })).canToggle).toBe(
      true,
    );
  });
});
