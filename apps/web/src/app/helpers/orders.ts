import {
  itemCountOf,
  toPurchaseLines,
  type Authorization,
  type AuthorizationDetail,
  type DeclineReason,
  type OrderLine,
  type PurchaseLine,
  type ReversalReason,
} from '@acme/contracts';
import type { StatusTone } from '@acme/ui';
import { t } from '@/app/i18n';
import { itemCountLabel, productName } from './cart';
import { formatDateTime } from './dates';
import { formatAmount } from './money';
import { AUTHORIZATION_STATUS } from './statusLabels';

/** The short word shown on a declined order. Keys, not copy. */
export const DECLINE_SHORT: Record<DeclineReason, string> = {
  insufficient_funds: 'activity.orders.declineShort.insufficient_funds',
  card_frozen: 'activity.orders.declineShort.card_frozen',
  account_not_active: 'activity.orders.declineShort.account_not_active',
  invalid_card: 'activity.orders.declineShort.invalid_card',
};

export interface OrderLineView {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  /** "2 × $8.50". */
  quantityLabel: string;
  total: string;
}

export interface OrderRow {
  id: string;
  merchant: string;
  /** "Taquería El Sol · 2 artículos" for store orders; the merchant alone otherwise. */
  title: string;
  /** When it happened, plus the short decline reason when declined. */
  detail: string;
  amount: string;
  statusKey: string;
  tone: StatusTone;
  /** Only an order on hold can be cancelled (voided). */
  canCancel: boolean;
  lines: OrderLineView[];
  /** "2 × Tacos al pastor, 1 × Horchata": the lines at a glance (empty for a card purchase). */
  preview: string;
}

export interface TimelineStep {
  /** i18n key of the step ("Ordered", "Approved, on hold", "Posted", …). */
  labelKey: string;
  when: string;
}

export interface OrderDetail {
  id: string;
  merchant: string;
  /** When it was ordered. */
  when: string;
  amount: string;
  statusKey: string;
  tone: StatusTone;
  lines: OrderLineView[];
  /** What happened to the money, in words (held, charged, declined and why, released). */
  outcome: string;
  /** Each step that happened, oldest first. */
  timeline: TimelineStep[];
  /** While on hold: when the hold releases on its own if the merchant never posts it. */
  holdExpiry: string | null;
}

/** One priced line of an order (a hold's or a checkout receipt's), in the page locale. */
export function toOrderLineView(line: OrderLine): OrderLineView {
  const unit = formatAmount(line.unitCents);
  return {
    sku: line.sku,
    // The API stores the English name; the catalog gives it in the page's language.
    name: productName(line.sku, line.name),
    quantity: line.quantity,
    unit,
    quantityLabel: t('activity.detail.lineQuantity', { quantity: line.quantity, unit }),
    total: formatAmount(BigInt(line.unitCents) * BigInt(line.quantity)),
  };
}

/** One priced line as the API returns it in an order's detail (its line total is the API's). */
function toPurchaseLineView(line: PurchaseLine): OrderLineView {
  const unit = formatAmount(line.unitPriceCents);
  return {
    sku: line.sku,
    name: productName(line.sku, line.name),
    quantity: line.quantity,
    unit,
    quantityLabel: t('activity.detail.lineQuantity', { quantity: line.quantity, unit }),
    total: formatAmount(line.lineTotalCents),
  };
}

/** One order of the account (a card authorization) as the lists show it, in the page locale. */
export function toOrderRow(item: Authorization): OrderRow {
  const status = AUTHORIZATION_STATUS[item.status];
  const itemCount = item.items.reduce((count, line) => count + line.quantity, 0);
  const when = formatDateTime(item.createdAt);
  const lines = item.items.map(toOrderLineView);
  return {
    id: item.id,
    merchant: item.merchantName,
    title:
      itemCount > 0
        ? t('activity.orders.summary', {
            merchant: item.merchantName,
            items: itemCountLabel(itemCount),
          })
        : item.merchantName,
    detail: item.declineReason ? `${when} · ${t(DECLINE_SHORT[item.declineReason])}` : when,
    amount: formatAmount(item.amountCents),
    statusKey: status.labelKey,
    tone: status.tone,
    canCancel: item.status === 'APPROVED',
    lines,
    preview: lines.map((line) => `${line.quantity} × ${line.name}`).join(', '),
  };
}

/** What happened to an order's money, in words: the detail sheet's "What happened". */
function orderOutcome(
  item: Pick<
    AuthorizationDetail,
    'status' | 'amountCents' | 'capturedCents' | 'declineReason' | 'reversalReason'
  >,
): string {
  switch (item.status) {
    case 'APPROVED':
      return t('activity.detail.outcome.APPROVED', { amount: formatAmount(item.amountCents) });
    case 'CAPTURED':
      // What was charged is the captured amount, which can be less than the hold.
      return t('activity.detail.outcome.CAPTURED', { amount: formatAmount(item.capturedCents) });
    case 'DECLINED':
      return t('activity.detail.outcome.DECLINED', {
        reason: t(
          item.declineReason
            ? DECLINE_LONG[item.declineReason]
            : 'activity.detail.declineReason.unknown',
        ),
      });
    case 'REVERSED':
      return t(REVERSAL_OUTCOME[item.reversalReason ?? 'network']);
  }
}

/**
 * Why a hold was released: the network voided it (a cancel), it expired uncaptured, or Acme Credit
 * released it. Each one says so in "What happened" and names its step. Keys, not copy.
 */
const REVERSAL_OUTCOME: Record<ReversalReason, string> = {
  network: 'activity.detail.outcome.REVERSED',
  expired: 'activity.detail.outcome.REVERSED_expired',
  admin_release: 'activity.detail.outcome.REVERSED_admin_release',
};

const REVERSAL_STEP: Record<ReversalReason, string> = {
  network: 'activity.detail.timeline.reversedAt',
  expired: 'activity.detail.timeline.expiredAt',
  admin_release: 'activity.detail.timeline.adminReleasedAt',
};

/** The why of a decline, as a sentence ending. Keys, not copy. */
const DECLINE_LONG: Record<DeclineReason, string> = {
  insufficient_funds: 'activity.detail.declineReason.insufficient_funds',
  card_frozen: 'activity.detail.declineReason.card_frozen',
  account_not_active: 'activity.detail.declineReason.account_not_active',
  invalid_card: 'activity.detail.declineReason.invalid_card',
};

/** The steps of a purchase in the order they happen; a step that did not happen is left out. */
const TIMELINE_STEPS = [
  ['createdAt', 'activity.detail.timeline.createdAt'],
  ['approvedAt', 'activity.detail.timeline.approvedAt'],
  ['declinedAt', 'activity.detail.timeline.declinedAt'],
  ['capturedAt', 'activity.detail.timeline.capturedAt'],
  ['reversedAt', 'activity.detail.timeline.reversedAt'],
] as const;

/** One order with everything its detail sheet shows, in the page locale. */
export function toOrderDetail(detail: AuthorizationDetail): OrderDetail {
  const status = AUTHORIZATION_STATUS[detail.status];
  return {
    id: detail.id,
    merchant: detail.merchantName,
    when: formatDateTime(detail.createdAt),
    amount: formatAmount(detail.amountCents),
    statusKey: status.labelKey,
    tone: status.tone,
    lines: detail.items.map(toPurchaseLineView),
    outcome: orderOutcome(detail),
    timeline: TIMELINE_STEPS.flatMap(([field, labelKey]) => {
      const at = detail.timeline[field];
      if (!at) return [];
      const label =
        field === 'reversedAt' ? REVERSAL_STEP[detail.reversalReason ?? 'network'] : labelKey;
      return [{ labelKey: label, when: formatDateTime(at) }];
    }),
    holdExpiry:
      detail.status === 'APPROVED' && detail.expiresAt ? formatDateTime(detail.expiresAt) : null,
  };
}

/**
 * What the orders list already knows about one order, in the detail's shape, so its sheet opens
 * at once while the detail loads. The list has no timeline: only "ordered" is known.
 */
export function detailFromListItem(item: Authorization, accountId: string): AuthorizationDetail {
  return {
    id: item.id,
    accountId,
    status: item.status,
    declineReason: item.declineReason,
    merchantName: item.merchantName,
    merchantMcc: item.merchantMcc,
    amountCents: item.amountCents,
    capturedCents: item.capturedCents,
    itemCount: itemCountOf(item.items),
    items: toPurchaseLines(item.items),
    timeline: {
      createdAt: item.createdAt,
      approvedAt: null,
      declinedAt: null,
      capturedAt: null,
      reversedAt: null,
    },
    expiresAt: item.expiresAt,
    reversalReason: item.reversalReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
