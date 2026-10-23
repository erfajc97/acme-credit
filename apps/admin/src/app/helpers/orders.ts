import { linesTotalCents, type AdminAuthorization, type OrderLine } from '@acme/contracts';
import type { StatusTone } from '@acme/ui';
import { accountHref } from '@/app/lib/endpoints';
import { formatDateTime } from './dates';
import { toHoldView, toReleaseTarget, type HoldView, type ReleaseTarget } from './holds';
import { formatAmount } from './money';
import { AUTHORIZATION_STATUS, DECLINE_REASON } from './statusLabels';

/**
 * What one order line costs: unit × quantity, through the contract's own total (G12: the core
 * checks the authorized amount with the same function), in integer cents.
 */
export function lineSubtotalCents(line: OrderLine): bigint {
  return linesTotalCents([line]);
}

export interface OrderLineView {
  key: string;
  quantity: number;
  /** The name the core stored with the hold (what the customer saw at checkout). */
  name: string;
  unit: string;
  subtotal: string;
}

/** The order lines of a store purchase as the console lists them: qty × name @ unit = subtotal. */
export function toOrderLineViews(lines: readonly OrderLine[]): OrderLineView[] {
  return lines.map((line, index) => ({
    key: `${index}:${line.sku}`,
    quantity: line.quantity,
    name: line.name,
    unit: formatAmount(line.unitCents),
    subtotal: formatAmount(lineSubtotalCents(line)),
  }));
}

export interface PurchaseRow {
  id: string;
  time: string;
  /** Null when the card was unknown to the core (the network still asked). */
  customer: { name: string; email: string } | null;
  /** The account's page, when the purchase belongs to one. */
  accountHref: string | null;
  merchant: string;
  mcc: string;
  statusKey: string;
  tone: StatusTone;
  /** The decline reason in words (i18n key), only for declines. */
  reasonKey: string | null;
  amount: string;
  /** What the network posted so far; null while nothing is (a hold, a decline). */
  captured: string | null;
  lines: OrderLineView[];
  hold: HoldView;
  /** What "Release hold" names; null unless the hold is live. */
  release: ReleaseTarget | null;
}

/**
 * One purchase of the wallet (an authorization) as the purchases views show it. "Expiring soon"
 * is measured against the clock when the rows are built (each fetch), not live.
 */
export function toPurchaseRow(item: AdminAuthorization): PurchaseRow {
  const status = AUTHORIZATION_STATUS[item.status];
  const hold = toHoldView(item, Date.now());
  return {
    id: item.id,
    time: formatDateTime(item.createdAt),
    customer: item.customer ? { name: item.customer.fullName, email: item.customer.email } : null,
    accountHref: item.accountId ? accountHref(item.accountId) : null,
    merchant: item.merchantName,
    mcc: item.merchantMcc,
    statusKey: status.labelKey,
    tone: status.tone,
    reasonKey: item.declineReason ? DECLINE_REASON[item.declineReason] : null,
    amount: formatAmount(item.amountCents),
    captured: item.capturedCents === '0' ? null : formatAmount(item.capturedCents),
    lines: toOrderLineViews(item.items),
    hold,
    release: hold.canRelease ? toReleaseTarget(item, item.customer?.fullName ?? null) : null,
  };
}
