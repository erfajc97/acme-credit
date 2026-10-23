import type { CheckoutResult } from '@acme/contracts';
import { formatAmount } from '@/app/helpers/money';
import { toOrderLineView } from '@/app/helpers/orders';
import { DECLINE_COPY, DECLINE_NEXT_STEP } from '../data';
import type { CheckoutOutcome } from '../types';

/**
 * The page's sentence for the network's answer. Every money message names the amounts
 * (docs/brand.md): a decline says why, with the total and what was available, and the next step;
 * an approval is a receipt of the lines the network priced.
 */
export function checkoutOutcome(
  result: CheckoutResult,
  availableBeforeCents: string,
): CheckoutOutcome {
  const total = formatAmount(result.totalCents);
  const merchant = result.merchantName;
  if (result.status === 'DECLINED') {
    const reason = result.declineReason ?? 'invalid_card';
    return {
      kind: 'declined',
      titleKey: 'checkout.result.declinedTitle',
      bodyKey: DECLINE_COPY[reason],
      params: {
        total,
        merchant,
        available: formatAmount(result.availableCents ?? availableBeforeCents),
      },
      next: DECLINE_NEXT_STEP[reason],
    };
  }
  return {
    kind: 'approved',
    titleKey: 'checkout.result.approvedTitle',
    params: { total, merchant },
    total,
    lines: result.lines.map(toOrderLineView),
  };
}
