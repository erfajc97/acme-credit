import { findProduct, MAX_LINE_QUANTITY, type StoreMerchantId } from '@acme/contracts';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const CART_STORAGE_KEY = 'acme.cart';

/** "conflict": the SKU belongs to another merchant; the screen asks before switching carts. */
export type AddResult = 'added' | 'conflict' | 'ignored';

interface CartState {
  /** One authorization per merchant, so a cart holds products of one merchant only. */
  merchant: StoreMerchantId | null;
  /** SKU → quantity (1..MAX_LINE_QUANTITY). Prices are never stored: the network prices. */
  quantities: Record<string, number>;
  add: (sku: string) => AddResult;
  setQuantity: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  /** Empties the cart and starts a new one with this SKU (after the customer agreed). */
  startNewCart: (sku: string) => void;
}

const EMPTY = { merchant: null, quantities: {} } satisfies Pick<
  CartState,
  'merchant' | 'quantities'
>;

function without(quantities: Record<string, number>, sku: string): Record<string, number> {
  return Object.fromEntries(Object.entries(quantities).filter(([key]) => key !== sku));
}

/**
 * The store's cart, shared by the store, the checkout and the nav badge (WA3: islands share state
 * through stores). Persisted in sessionStorage for the tab: it holds SKUs and quantities only, no
 * secret and no price (W14).
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      add: (sku) => {
        const product = findProduct(sku);
        if (!product) return 'ignored';
        const { merchant, quantities } = get();
        if (merchant !== null && merchant !== product.merchant) return 'conflict';
        const next = Math.min((quantities[sku] ?? 0) + 1, MAX_LINE_QUANTITY);
        set({ merchant: product.merchant, quantities: { ...quantities, [sku]: next } });
        return 'added';
      },
      setQuantity: (sku, quantity) => {
        if (quantity < 1) {
          get().remove(sku);
          return;
        }
        const { quantities } = get();
        if (quantities[sku] === undefined) return;
        set({ quantities: { ...quantities, [sku]: Math.min(quantity, MAX_LINE_QUANTITY) } });
      },
      remove: (sku) => {
        const quantities = without(get().quantities, sku);
        set(Object.keys(quantities).length === 0 ? EMPTY : { quantities });
      },
      clear: () => set(EMPTY),
      startNewCart: (sku) => {
        set(EMPTY);
        get().add(sku);
      },
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => window.sessionStorage),
      partialize: ({ merchant, quantities }) => ({ merchant, quantities }),
    },
  ),
);
