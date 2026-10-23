import { STORE_MERCHANTS } from '@acme/contracts';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  cartLines,
  cartSummary,
  checkoutItems,
  exceedsAvailable,
  itemCountLabel,
} from '@/app/helpers/cart';
import { formatAmount } from '@/app/helpers/money';
import { toOrderLineView } from '@/app/helpers/orders';
import { localHref } from '@/app/helpers/navigation';
import { ROUTES } from '@/app/lib/endpoints';
import { useCartStore } from '@/app/store/cartStore';
import { useAccountQuery } from '@/app/tanstack-queries/accountQuery';
import { checkoutOutcome } from '../helpers/checkoutOutcome';
import { useCheckoutMutation } from '../mutations/useCheckoutMutation';
import type { CheckoutOutcome } from '../types';

export type CheckoutView = 'loading' | 'error' | 'noCard' | 'empty' | 'review' | 'result';

/**
 * Checkout: the cart's lines and total against what is available to spend, then one payment to
 * the card network. A total above "available" is warned about but still sent: the network's
 * decline is the real rule. An approval empties the cart; a decline keeps it.
 */
export function useCheckoutPage() {
  const account = useAccountQuery();
  const cart = useCartStore(useShallow(({ merchant, quantities }) => ({ merchant, quantities })));
  const mutation = useCheckoutMutation();
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);

  const data = account.data ?? null;
  const card = data && (data.status === 'ACTIVE' || data.status === 'FROZEN') ? data.card : null;
  const lines = cartLines(cart.merchant, cart.quantities);
  const summary = cartSummary(lines);
  const availableCents = data?.availableCents ?? '0';
  const leftCents = BigInt(availableCents) - summary.totalCents;

  let view: CheckoutView = 'review';
  if (outcome) view = 'result';
  else if (account.isLoading) view = 'loading';
  else if (account.isError) view = 'error';
  else if (!card) view = 'noCard';
  else if (lines.length === 0) view = 'empty';

  const pay = () => {
    if (!card || !cart.merchant) return;
    mutation.mutate(
      { cardToken: card.token, merchant: cart.merchant, items: checkoutItems(lines) },
      {
        onSuccess: (result) => {
          setOutcome(checkoutOutcome(result, availableCents));
          if (result.status !== 'DECLINED') useCartStore.getState().clear();
        },
      },
    );
  };

  return {
    view,
    // refetch never rejects: a failure lands in the query state, shown by the error branch.
    retry: () => void account.refetch(),
    isRetrying: account.isFetching,
    merchantName: cart.merchant ? STORE_MERCHANTS[cart.merchant].name : '',
    lines: lines.map(({ sku, name, quantity, unitCents }) =>
      toOrderLineView({ sku, name, quantity, unitCents: unitCents.toString() }),
    ),
    items: itemCountLabel(summary.itemCount),
    total: formatAmount(summary.totalCents),
    available: formatAmount(availableCents),
    left: leftCents >= 0n ? formatAmount(leftCents) : null,
    isOverAvailable: exceedsAvailable(summary.totalCents, availableCents),
    card: card && {
      last4: card.last4,
      expiry: card.expiresMonth,
      isFrozen: data?.status === 'FROZEN',
    },
    pay,
    isPaying: mutation.isPending,
    outcome,
    /** Shown on the approval: the account as refetched after the order. */
    availableNow: formatAmount(availableCents),
    declineNextHref: outcome?.kind === 'declined' ? localHref(outcome.next.route) : '',
    hrefs: {
      store: localHref(ROUTES.store),
      activity: localHref(ROUTES.activity),
      wallet: localHref(ROUTES.app),
    },
  };
}
