import type { Authorization } from '@acme/contracts';
import type { StatusTone } from '@acme/ui';
import { formatDateTime } from '@/app/helpers/dates';
import {
  toHoldView,
  toReleaseTarget,
  type HoldView,
  type ReleaseTarget,
} from '@/app/helpers/holds';
import { formatAmount } from '@/app/helpers/money';
import { toOrderLineViews, type OrderLineView } from '@/app/helpers/orders';
import { AUTHORIZATION_STATUS, DECLINE_REASON } from '@/app/helpers/statusLabels';

export interface AuthorizationRow {
  id: string;
  time: string;
  merchant: string;
  mcc: string;
  amount: string;
  /** What the network posted so far; null while nothing is (a hold, a decline). */
  captured: string | null;
  statusKey: string;
  tone: StatusTone;
  /** The decline reason in words (i18n key), only for declines. */
  reasonKey: string | null;
  /** The order lines of a store purchase; empty for a plain card purchase. */
  lines: OrderLineView[];
  hold: HoldView;
  /** What "Release hold" names (the page adds the customer); null unless the hold is live. */
  release: ReleaseTarget | null;
}

export function toAuthorizationRow(item: Authorization): AuthorizationRow {
  const status = AUTHORIZATION_STATUS[item.status];
  const hold = toHoldView(item, Date.now());
  return {
    id: item.id,
    time: formatDateTime(item.createdAt),
    merchant: item.merchantName,
    mcc: item.merchantMcc,
    amount: formatAmount(item.amountCents),
    captured: item.capturedCents === '0' ? null : formatAmount(item.capturedCents),
    statusKey: status.labelKey,
    tone: status.tone,
    reasonKey: item.declineReason ? DECLINE_REASON[item.declineReason] : null,
    lines: toOrderLineViews(item.items),
    hold,
    release: hold.canRelease ? toReleaseTarget(item, null) : null,
  };
}
