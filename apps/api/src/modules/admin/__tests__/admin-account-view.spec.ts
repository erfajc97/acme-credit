import type { Account } from '@acme/contracts';
import { describe, expect, it } from 'vitest';
import { toAdminAccountAction, toAdminCloseResponse } from '../helpers/admin-account-view';

const TOKEN = 'card_tok_live_7f3a9c';
const AT = '2026-10-21T12:00:00.000Z';
const ACCOUNT: Account = {
  id: '6d1f8a2b-3c4d-4e5f-9a0b-1c2d3e4f5a6b',
  status: 'FROZEN',
  currency: 'USD',
  collateralCents: '50000',
  creditLimitCents: '50000',
  heldCents: '1000',
  postedDebtCents: '2000',
  availableCents: '47000',
  card: { last4: '4242', token: TOKEN, expiresMonth: '10/29' },
  frozenBy: 'ADMIN',
  openedAt: AT,
  activatedAt: AT,
  closedAt: null,
};

/** Every key an admin action answer may carry (FT20: the exact set, not "no token"). */
const ACTION_KEYS = [
  'activatedAt',
  'availableCents',
  'card',
  'closedAt',
  'collateralCents',
  'creditLimitCents',
  'currency',
  'frozenBy',
  'heldCents',
  'id',
  'openedAt',
  'postedDebtCents',
  'status',
];

describe('admin account answers mask the card (A5: the token is the purchase credential)', () => {
  it('keeps every account field and only last4 and expiry of the card', () => {
    const view = toAdminAccountAction(ACCOUNT);
    expect(Object.keys(view).sort()).toEqual(ACTION_KEYS);
    expect(view.card).toEqual({ last4: '4242', expiresMonth: '10/29' });
    expect(JSON.stringify(view)).not.toContain(TOKEN);
    expect(view).toMatchObject({ id: ACCOUNT.id, status: 'FROZEN', heldCents: '1000' });
  });

  it('answers a null card for an account without one', () => {
    expect(toAdminAccountAction({ ...ACCOUNT, card: null }).card).toBeNull();
  });

  it('masks the closed account of a close and keeps its settlement', () => {
    const settlement = {
      collateralCents: '50000',
      appliedToDebtCents: '2000',
      releasedCents: '48000',
    };
    const view = toAdminCloseResponse({ account: ACCOUNT, settlement });
    expect(Object.keys(view).sort()).toEqual(['account', 'settlement']);
    expect(Object.keys(view.account).sort()).toEqual(ACTION_KEYS);
    expect(view.settlement).toEqual(settlement);
    expect(JSON.stringify(view)).not.toContain(TOKEN);
  });
});
