import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { CartBadge } from './components/CartBadge';
import { useCartCount } from './hooks/useCartCount';

// No services/, mutations/ or types.ts: it only reads the shared cart store (src/app/store).
function CartCountBadge() {
  const cart = useCartCount();
  return <CartBadge count={cart.count} label={cart.label} />;
}

/** The cart count on the Store link (nav), shared with the store islands through the cart store (WA3). */
export default function CartCount({ locale }: Pick<IslandProps, 'locale'>) {
  return (
    <AppProviders locale={locale}>
      <CartCountBadge />
    </AppProviders>
  );
}
