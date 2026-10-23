import type { DeclineReason } from '@acme/contracts';
import { ROUTES } from '@/app/lib/endpoints';

/** Each decline reason in words: what happened, with both amounts, and what to do next. */
export const DECLINE_COPY: Record<DeclineReason, string> = {
  insufficient_funds: 'checkout.decline.insufficient_funds',
  card_frozen: 'checkout.decline.card_frozen',
  account_not_active: 'checkout.decline.account_not_active',
  invalid_card: 'checkout.decline.invalid_card',
};

/** The next step offered after a decline (a link, in the page locale). */
export const DECLINE_NEXT_STEP: Record<DeclineReason, { labelKey: string; route: string }> = {
  insufficient_funds: { labelKey: 'checkout.result.makePayment', route: ROUTES.app },
  card_frozen: { labelKey: 'checkout.result.openWallet', route: ROUTES.app },
  account_not_active: { labelKey: 'checkout.result.openWallet', route: ROUTES.app },
  invalid_card: { labelKey: 'checkout.result.editCart', route: ROUTES.store },
};
