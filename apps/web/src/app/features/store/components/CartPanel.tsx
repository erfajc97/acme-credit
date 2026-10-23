import { MAX_LINE_QUANTITY } from '@acme/contracts';
import { AmountText, AppButton, ButtonLink, EmptyState, QuantityStepper } from '@acme/ui';
import { ShoppingBag } from 'lucide-react';
import { Icon } from '@/app/components/UI/Icon';
import { t } from '@/app/i18n';
import type { CartLineView } from '../types';

interface CartPanelProps {
  merchantName: string;
  lines: CartLineView[];
  items: string;
  total: string;
  isEmpty: boolean;
  checkoutHref: string;
  onQuantityChange: (sku: string, quantity: number) => void;
  onRemove: (sku: string) => void;
  onClear: () => void;
  /** Phones: the sheet around the panel draws the heading. */
  showTitle: boolean;
}

/** The cart: its merchant, each line with a stepper, the total and the way to checkout. */
export function CartPanel({
  merchantName,
  lines,
  items,
  total,
  isEmpty,
  checkoutHref,
  onQuantityChange,
  onRemove,
  onClear,
  showTitle,
}: CartPanelProps) {
  const title = showTitle && (
    <h2 className="font-display text-h3 font-bold">{t('store.cart.title')}</h2>
  );
  if (isEmpty) {
    return (
      <div className="flex flex-col gap-3">
        {title}
        <EmptyState
          headingLevel={3}
          icon={<Icon icon={ShoppingBag} size={24} />}
          title={t('store.cart.emptyTitle')}
          body={t('store.cart.emptyBody')}
        />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        {title}
        <p className="text-small font-semibold text-violet">
          {t('store.cart.fromMerchant', { merchant: merchantName })}
        </p>
      </div>
      <ul className="-mx-1 flex flex-col px-1 fit:min-h-0 fit:overflow-y-auto fit:overscroll-contain">
        {lines.map((line) => (
          <li
            key={line.sku}
            className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-medium">{line.name}</span>
              <AmountText value={line.total} />
            </div>
            <QuantityStepper
              label={t('store.quantityLabel', { product: line.name })}
              value={line.quantity}
              max={MAX_LINE_QUANTITY}
              onChange={(quantity) => onQuantityChange(line.sku, quantity)}
              onRemove={() => onRemove(line.sku)}
              removeLabel={t('store.removeLabel', { product: line.name })}
              decreaseLabel={t('store.decreaseLabel', { product: line.name })}
              increaseLabel={t('store.increaseLabel', { product: line.name })}
            />
          </li>
        ))}
      </ul>
      <dl className="flex items-baseline justify-between gap-4 border-t-[1.6px] border-ink pt-4">
        <dt className="flex flex-col">
          <span className="font-display text-body font-bold">{t('store.cart.total')}</span>
          <span className="text-small text-muted">{items}</span>
        </dt>
        <dd className="text-h3 font-medium">
          <AmountText value={total} />
        </dd>
      </dl>
      <ButtonLink href={checkoutHref} fullWidth>
        {t('store.cart.checkout')}
      </ButtonLink>
      <AppButton variant="ghost" size="compact" onPress={onClear}>
        {t('store.cart.clear')}
      </AppButton>
    </div>
  );
}
