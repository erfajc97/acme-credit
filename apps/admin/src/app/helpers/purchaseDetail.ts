import type { Authorization } from '@acme/contracts';
import type { StatusTone } from '@acme/ui';
import { formatDateTime } from './dates';
import { formatAmount } from './money';
import { lineSubtotalCents } from './orders';
import { AUTHORIZATION_STATUS, DECLINE_REASON, REVERSAL_REASON } from './statusLabels';

/** The brand illustration of a store product, shipped under public/products/ (named by SKU). */
export function productImageSrc(sku: string): string {
  return `/products/${encodeURIComponent(sku)}.svg`;
}

/** Done (success), refused (danger), closed without a charge (neutral) or still ahead (pending). */
export type TimelineTone = 'success' | 'danger' | 'neutral' | 'pending';

export interface TimelineStep {
  key: 'approved' | 'declined' | 'captured' | 'released' | 'expires';
  labelKey: string;
  params?: Record<string, string>;
  /** Why it was declined or released (i18n key). */
  reasonKey: string | null;
  time: string;
  tone: TimelineTone;
}

export interface DetailLine {
  key: string;
  sku: string;
  name: string;
  imageSrc: string;
  quantity: number;
  unit: string;
  subtotal: string;
}

export interface PurchaseDetail {
  id: string;
  merchant: string;
  mcc: string;
  customer: { name: string; email: string } | null;
  date: string;
  statusKey: string;
  tone: StatusTone;
  timeline: TimelineStep[];
  lines: DetailLine[];
  /** What was authorized: the sum of the lines for a store order (the core checks they match). */
  total: string;
  /** What the merchant charged so far; null while nothing is. */
  captured: string | null;
}

const step = (
  key: TimelineStep['key'],
  tone: TimelineTone,
  at: string,
  extra: Partial<Pick<TimelineStep, 'params' | 'reasonKey'>> = {},
): TimelineStep => ({
  key,
  labelKey: `purchaseDetail.timeline.${key}`,
  reasonKey: null,
  time: formatDateTime(at),
  tone,
  ...extra,
});

/**
 * What happened to a purchase, from the authorization itself (the admin API has no event list):
 * the decision is taken when it is created; a capture or a release is its last update; a live
 * hold ends with when it lapses on its own.
 */
function timelineOf(item: Authorization): TimelineStep[] {
  if (item.status === 'DECLINED') {
    const reasonKey = item.declineReason ? DECLINE_REASON[item.declineReason] : null;
    return [step('declined', 'danger', item.createdAt, { reasonKey })];
  }
  const steps = [
    step('approved', 'success', item.createdAt, {
      params: { amount: formatAmount(item.amountCents) },
    }),
  ];
  if (item.status === 'CAPTURED') {
    steps.push(
      step('captured', 'success', item.updatedAt, {
        params: { amount: formatAmount(item.capturedCents) },
      }),
    );
  } else if (item.status === 'REVERSED') {
    const reasonKey = item.reversalReason ? REVERSAL_REASON[item.reversalReason] : null;
    steps.push(step('released', 'neutral', item.updatedAt, { reasonKey }));
  } else if (item.expiresAt) {
    steps.push(step('expires', 'pending', item.expiresAt));
  }
  return steps;
}

/** One purchase as the detail sheet shows it: who, where, what happened and every priced line. */
export function toPurchaseDetail(
  item: Authorization,
  customer: { name: string; email: string } | null,
): PurchaseDetail {
  const status = AUTHORIZATION_STATUS[item.status];
  return {
    id: item.id,
    merchant: item.merchantName,
    mcc: item.merchantMcc,
    customer,
    date: formatDateTime(item.createdAt),
    statusKey: status.labelKey,
    tone: status.tone,
    timeline: timelineOf(item),
    lines: item.items.map((line, index) => ({
      key: `${index}:${line.sku}`,
      sku: line.sku,
      name: line.name,
      imageSrc: productImageSrc(line.sku),
      quantity: line.quantity,
      unit: formatAmount(line.unitCents),
      subtotal: formatAmount(lineSubtotalCents(line)),
    })),
    total: formatAmount(item.amountCents),
    captured: item.capturedCents === '0' ? null : formatAmount(item.capturedCents),
  };
}
