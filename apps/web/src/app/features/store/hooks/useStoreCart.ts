import { findProduct, STORE_MERCHANTS, type StoreMerchantId } from '@acme/contracts';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cartLines, cartSummary, itemCountLabel } from '@/app/helpers/cart';
import { formatAmount } from '@/app/helpers/money';
import { useDisclosure } from '@/app/hooks/useDisclosure';
import { useCartStore } from '@/app/store/cartStore';
import type { CartLineView } from '../types';

/**
 * The store's cart: one merchant per cart (one card authorization per merchant). Adding from
 * another merchant does not mix carts: it asks first, and only switches when the customer agrees.
 */
export function useStoreCart() {
  const cart = useCartStore(useShallow(({ merchant, quantities }) => ({ merchant, quantities })));
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const sheet = useDisclosure();
  const lines = cartLines(cart.merchant, cart.quantities);
  const summary = cartSummary(lines);
  const merchantName = (id: StoreMerchantId | null | undefined) =>
    id ? STORE_MERCHANTS[id].name : '';

  return {
    quantities: cart.quantities,
    /** True when the product went into the cart; false when it waits for the switch dialog. */
    add: (sku: string): boolean => {
      if (useCartStore.getState().add(sku) !== 'conflict') return true;
      setPendingSku(sku);
      return false;
    },
    setQuantity: (sku: string, quantity: number) =>
      useCartStore.getState().setQuantity(sku, quantity),
    remove: (sku: string) => useCartStore.getState().remove(sku),
    clear: () => useCartStore.getState().clear(),
    merchantName: merchantName(cart.merchant),
    lines: lines.map((line): CartLineView => ({
      sku: line.sku,
      name: line.name,
      quantity: line.quantity,
      total: formatAmount(line.lineCents),
    })),
    itemCount: summary.itemCount,
    items: itemCountLabel(summary.itemCount),
    total: formatAmount(summary.totalCents),
    isEmpty: lines.length === 0,
    sheet,
    switchDialog: {
      isOpen: pendingSku !== null,
      current: merchantName(cart.merchant),
      next: merchantName(pendingSku ? findProduct(pendingSku)?.merchant : null),
      confirm: () => {
        if (pendingSku) useCartStore.getState().startNewCart(pendingSku);
        setPendingSku(null);
      },
      onOpenChange: (isOpen: boolean) => {
        if (!isOpen) setPendingSku(null);
      },
    },
  };
}
