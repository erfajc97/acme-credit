import type { Account } from '@acme/contracts';
import type { Prisma } from '../../generated/prisma/client';
import { availableCredit, centsToString } from '../../core/money/money';

/** Every column an Account response may show (A5): a new column is exposed only from here. */
export const accountSelect = {
  id: true,
  status: true,
  collateralCents: true,
  creditLimitCents: true,
  heldCents: true,
  postedDebtCents: true,
  cardLast4: true,
  cardToken: true,
  cardExpiresOn: true,
  openedAt: true,
  activatedAt: true,
  closedAt: true,
  frozenBy: true,
  freezeReason: true,
} satisfies Prisma.AccountSelect;

export type AccountRow = Prisma.AccountGetPayload<{ select: typeof accountSelect }>;

/** `MM/YY` of the first day of the expiry month (UTC). */
export function expiryMonth(expiresOn: Date): string {
  const month = String(expiresOn.getUTCMonth() + 1).padStart(2, '0');
  const year = String(expiresOn.getUTCFullYear() % 100).padStart(2, '0');
  return `${month}/${year}`;
}

export function toAccountBalances(row: AccountRow) {
  return {
    collateralCents: centsToString(row.collateralCents),
    creditLimitCents: centsToString(row.creditLimitCents),
    heldCents: centsToString(row.heldCents),
    postedDebtCents: centsToString(row.postedDebtCents),
    availableCents: centsToString(availableCredit(row)),
  };
}

export function toAccount(row: AccountRow): Account {
  const card =
    row.cardLast4 && row.cardToken && row.cardExpiresOn
      ? { last4: row.cardLast4, token: row.cardToken, expiresMonth: expiryMonth(row.cardExpiresOn) }
      : null;
  return {
    id: row.id,
    status: row.status,
    currency: 'USD',
    ...toAccountBalances(row),
    card,
    frozenBy: row.frozenBy,
    openedAt: row.openedAt.toISOString(),
    activatedAt: row.activatedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}
