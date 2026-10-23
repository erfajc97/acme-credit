import type { AccountRow } from '../account.mapper';

/** An ACTIVE account row with a unique value per field (FT5). */
export function accountRow(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 'a1',
    status: 'ACTIVE',
    collateralCents: 20_000n,
    creditLimitCents: 20_000n,
    heldCents: 1_500n,
    postedDebtCents: 2_500n,
    cardLast4: '4242',
    cardToken: 'card_abcdefghijklmnopqrstuvwx',
    cardExpiresOn: new Date('2030-10-01T00:00:00.000Z'),
    openedAt: new Date('2026-10-01T09:00:00.000Z'),
    activatedAt: new Date('2026-10-02T09:00:00.000Z'),
    closedAt: null,
    frozenBy: null,
    freezeReason: null,
    ...overrides,
  };
}
