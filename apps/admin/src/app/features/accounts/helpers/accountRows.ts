import type { AdminAccount } from '@acme/contracts';
import type { StatusTone } from '@acme/ui';
import { formatDate } from '@/app/helpers/dates';
import { formatAmount } from '@/app/helpers/money';
import { ACCOUNT_STATUS } from '@/app/helpers/statusLabels';
import { accountHref } from '@/app/lib/endpoints';

export interface AccountRow {
  id: string;
  href: string;
  name: string;
  email: string;
  statusKey: string;
  tone: StatusTone;
  collateral: string;
  limit: string;
  held: string;
  owed: string;
  available: string;
  /** Last four digits, or null before a card is issued. */
  cardLast4: string | null;
  opened: string;
}

/** One account as the list shows it: every amount formatted from cents, status in words. */
export function toAccountRow(account: AdminAccount): AccountRow {
  const status = ACCOUNT_STATUS[account.status];
  return {
    id: account.id,
    href: accountHref(account.id),
    name: account.customer.fullName,
    email: account.customer.email,
    statusKey: status.labelKey,
    tone: status.tone,
    collateral: formatAmount(account.collateralCents),
    limit: formatAmount(account.creditLimitCents),
    held: formatAmount(account.heldCents),
    owed: formatAmount(account.postedDebtCents),
    available: formatAmount(account.availableCents),
    cardLast4: account.cardLast4,
    opened: formatDate(account.openedAt),
  };
}
