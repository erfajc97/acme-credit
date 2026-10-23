import { AppButton } from '@acme/ui';
import { t } from '@/app/i18n';

interface CartBarProps {
  items: string;
  total: string;
  onOpen: () => void;
}

/**
 * Phones: the cart sits at thumb reach, floating above the tab bar (W9), and opens the cart sheet.
 * Desktop shows the sticky cart panel instead.
 */
export function CartBar({ items, total, onOpen }: CartBarProps) {
  return (
    <div className="fixed inset-x-4 bottom-(--bottom-nav-space) z-30 lg:hidden">
      <AppButton fullWidth onPress={onOpen}>
        {t('store.cart.open', { items, total })}
      </AppButton>
    </div>
  );
}
