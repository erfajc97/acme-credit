import { describe, expect, it } from 'vitest';
import { expiryMonth, toAccount } from '../account.mapper';
import { accountRow } from './fixtures';
import {
  assertCanFreeze,
  assertCanUnfreeze,
  freezeActorOf,
  isCardExpired,
  issueCard,
  settleOnClose,
} from '../helpers/account-rules';

const NOW = new Date('2026-10-21T12:00:00.000Z');

describe('card issuance', () => {
  it('issues a 4-digit last4, an unguessable token and a 4-year expiry', () => {
    const card = issueCard(NOW);
    expect(card.cardLast4).toMatch(/^\d{4}$/);
    expect(card.cardToken).toMatch(/^card_[A-Za-z0-9_-]{24}$/);
    expect(card.cardExpiresOn.toISOString()).toBe('2030-10-01T00:00:00.000Z');
    expect(issueCard(NOW).cardToken).not.toBe(card.cardToken);
  });

  it('is valid through the last day of its expiry month', () => {
    const expiresOn = new Date('2030-10-01T00:00:00.000Z');
    expect(isCardExpired(expiresOn, new Date('2030-10-31T23:59:59.999Z'))).toBe(false);
    expect(isCardExpired(expiresOn, new Date('2030-11-01T00:00:00.000Z'))).toBe(true);
    expect(expiryMonth(expiresOn)).toBe('10/30');
    expect(expiryMonth(new Date('2031-01-01T00:00:00.000Z'))).toBe('01/31');
  });
});

describe('status rules', () => {
  const active = { status: 'ACTIVE' as const, frozenBy: null };
  const byCustomer = { status: 'FROZEN' as const, frozenBy: 'CUSTOMER' as const };
  const byAdmin = { status: 'FROZEN' as const, frozenBy: 'ADMIN' as const };

  it('freezes only an ACTIVE account', () => {
    expect(() => assertCanFreeze(active, 'CUSTOMER')).not.toThrow();
    expect(() => assertCanFreeze(active, 'ADMIN')).not.toThrow();
    expect(() => assertCanFreeze(byCustomer, 'CUSTOMER')).toThrow(
      expect.objectContaining({ code: 'account.not_active' }),
    );
    expect(() => assertCanFreeze(byAdmin, 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'account.not_active' }),
    );
    expect(() => assertCanFreeze(byAdmin, 'CUSTOMER')).toThrow(
      expect.objectContaining({ code: 'account.not_active' }),
    );
    expect(() =>
      assertCanFreeze({ status: 'PENDING_COLLATERAL', frozenBy: null }, 'ADMIN'),
    ).toThrow(expect.objectContaining({ code: 'account.not_active' }));
    expect(() => assertCanFreeze({ status: 'CLOSED', frozenBy: null }, 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'account.closed' }),
    );
  });

  it("lets an admin take over a customer's freeze, so the customer can no longer lift it", () => {
    expect(() => assertCanFreeze(byCustomer, 'ADMIN')).not.toThrow();
  });

  it('unfreezes only a FROZEN account', () => {
    expect(() => assertCanUnfreeze(byCustomer, 'CUSTOMER')).not.toThrow();
    expect(() => assertCanUnfreeze(active, 'CUSTOMER')).toThrow(
      expect.objectContaining({ code: 'account.not_frozen' }),
    );
    expect(() => assertCanUnfreeze({ status: 'CLOSED', frozenBy: null }, 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'account.closed' }),
    );
  });

  it('refuses a customer lifting an admin freeze; an admin lifts both (attacker case)', () => {
    // The audit HIGH: a customer whose card the bank froze unfroze it from the wallet.
    expect(() => assertCanUnfreeze(byAdmin, 'CUSTOMER')).toThrow(
      expect.objectContaining({ code: 'account.frozen_by_admin', status: 409 }),
    );
    expect(() => assertCanUnfreeze(byAdmin, 'ADMIN')).not.toThrow();
    expect(() => assertCanUnfreeze(byCustomer, 'ADMIN')).not.toThrow();
  });

  it('maps the audit actor to who froze the card: only an admin is ADMIN', () => {
    expect(freezeActorOf('admin')).toBe('ADMIN');
    expect(freezeActorOf('customer')).toBe('CUSTOMER');
  });
});

describe('settleOnClose (R-05)', () => {
  const open = { status: 'ACTIVE' as const, collateralCents: 20_000n, heldCents: 0n };

  it('releases the whole collateral in good standing', () => {
    expect(settleOnClose({ ...open, postedDebtCents: 0n })).toEqual({
      collateralCents: 20_000n,
      appliedToDebtCents: 0n,
      releasedCents: 20_000n,
    });
  });

  it('applies the collateral to the debt first and releases the rest', () => {
    expect(settleOnClose({ ...open, postedDebtCents: 7_550n })).toEqual({
      collateralCents: 20_000n,
      appliedToDebtCents: 7_550n,
      releasedCents: 12_450n,
    });
    // Debt larger than the collateral: everything is applied, nothing released.
    expect(settleOnClose({ ...open, collateralCents: 100n, postedDebtCents: 101n })).toEqual({
      collateralCents: 100n,
      appliedToDebtCents: 100n,
      releasedCents: 0n,
    });
  });

  it('refuses a closed account and any pending hold, even one cent', () => {
    expect(() => settleOnClose({ ...open, heldCents: 1n, postedDebtCents: 0n })).toThrow(
      expect.objectContaining({ code: 'account.pending_holds' }),
    );
    expect(() => settleOnClose({ ...open, status: 'CLOSED', postedDebtCents: 0n })).toThrow(
      expect.objectContaining({ code: 'account.closed' }),
    );
  });
});

describe('toAccount (A5)', () => {
  it('maps balances as cent strings, the card, and the available credit', () => {
    expect(toAccount(accountRow())).toEqual({
      id: 'a1',
      status: 'ACTIVE',
      currency: 'USD',
      collateralCents: '20000',
      creditLimitCents: '20000',
      heldCents: '1500',
      postedDebtCents: '2500',
      availableCents: '16000',
      card: { last4: '4242', token: 'card_abcdefghijklmnopqrstuvwx', expiresMonth: '10/30' },
      frozenBy: null,
      openedAt: '2026-10-01T09:00:00.000Z',
      activatedAt: '2026-10-02T09:00:00.000Z',
      closedAt: null,
    });
  });

  it('shows no card before activation', () => {
    const pending = toAccount(
      accountRow({
        status: 'PENDING_COLLATERAL',
        cardLast4: null,
        cardToken: null,
        cardExpiresOn: null,
        activatedAt: null,
        closedAt: NOW,
      }),
    );
    expect(pending.card).toBeNull();
    expect(pending.activatedAt).toBeNull();
    expect(pending.closedAt).toBe(NOW.toISOString());
  });
});
