import { cartLines, cartSummary } from '@/app/helpers/cart';
import { t } from '@/app/i18n';
import { useCartStore } from '@/app/store/cartStore';

/** How many items the cart holds, for the Store tab's badge (0 = no badge). */
export function useCartCount() {
  const merchant = useCartStore((state) => state.merchant);
  const quantities = useCartStore((state) => state.quantities);
  const count = cartSummary(cartLines(merchant, quantities)).itemCount;
  return { count, label: t('a11y.cartCount', { count }) };
}
