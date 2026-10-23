import { describe, expect, it } from 'vitest';
import { adminAccountActionSchema, adminCloseAccountResponseSchema } from '../index';

const AT = '2026-10-21T12:00:00.000Z';
const account = {
  id: '6d1f8a2b-3c4d-4e5f-9a0b-1c2d3e4f5a6b',
  status: 'FROZEN',
  currency: 'USD',
  collateralCents: '50000',
  creditLimitCents: '50000',
  heldCents: '0',
  postedDebtCents: '0',
  availableCents: '50000',
  card: { last4: '4242', expiresMonth: '10/29' },
  frozenBy: 'ADMIN',
  openedAt: AT,
  activatedAt: AT,
  closedAt: null,
};
const settlement = { collateralCents: '50000', appliedToDebtCents: '0', releasedCents: '50000' };

describe('admin account action answers (A5: the card token never reaches the back office)', () => {
  it('accepts the account with a masked card, or without a card', () => {
    expect(adminAccountActionSchema.safeParse(account).success).toBe(true);
    expect(adminAccountActionSchema.safeParse({ ...account, card: null }).success).toBe(true);
    expect(adminCloseAccountResponseSchema.safeParse({ account, settlement }).success).toBe(true);
  });

  it('refuses a card that carries its token, in freeze/unfreeze and in close', () => {
    const leaked = { ...account, card: { ...account.card, token: 'tok_abc' } };
    expect(adminAccountActionSchema.safeParse(leaked).success).toBe(false);
    expect(adminCloseAccountResponseSchema.safeParse({ account: leaked, settlement }).success).toBe(
      false,
    );
  });
});
