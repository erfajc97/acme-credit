import { MAX_LINE_QUANTITY } from '@acme/contracts';
import { AmountText, AppButton, QuantityStepper, SafeImage } from '@acme/ui';
import { Plus } from 'lucide-react';
import { Icon } from '@/app/components/UI/Icon';
import { t } from '@/app/i18n';
import type { ProductView } from '../types';
import { CategoryTile } from './CategoryTile';

interface ProductCardProps {
  product: ProductView;
  onAdd: (sku: string) => void;
  onQuantityChange: (sku: string, quantity: number) => void;
  onRemove: (sku: string) => void;
}

/**
 * One compact, near-square product: its illustration edge to edge (4:3; the category tile when it
 * is missing), merchant, name (2 lines), description (1 line, from sm), then price and "Add" on
 * one row ("+" alone on cards narrower than 16rem; its name says what it adds) or the quantity stepper (1..20).
 */
export function ProductCard({ product, onAdd, onQuantityChange, onRemove }: ProductCardProps) {
  return (
    <li className="@container flex flex-col overflow-hidden rounded-card border-[1.6px] border-ink bg-surface-raised shadow-raised">
      <div className="overflow-hidden border-b-[1.6px] border-ink">
        <SafeImage
          key={product.imageSrc}
          src={product.imageSrc}
          alt={product.name}
          width={640}
          height={400}
          loading={product.imageLoading}
          className="block aspect-4/3 w-full object-cover"
          fallback={<CategoryTile category={product.category} />}
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="truncate text-caption font-semibold tracking-wide text-violet uppercase">
          {product.merchantName}
        </p>
        <h3 className="line-clamp-2 font-display text-small font-bold text-fg">{product.name}</h3>
        <p className="hidden truncate text-caption text-muted sm:block">{product.description}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="text-body font-medium">
            <AmountText value={product.price} />
          </span>
          {product.quantity > 0 ? (
            <QuantityStepper
              label={t('store.quantityLabel', { product: product.name })}
              value={product.quantity}
              max={MAX_LINE_QUANTITY}
              onChange={(quantity) => onQuantityChange(product.sku, quantity)}
              onRemove={() => onRemove(product.sku)}
              removeLabel={t('store.removeLabel', { product: product.name })}
              decreaseLabel={t('store.decreaseLabel', { product: product.name })}
              increaseLabel={t('store.increaseLabel', { product: product.name })}
              focusIncreaseOnMount={product.autoFocus === 'stepper'}
            />
          ) : (
            <AppButton
              variant="secondary"
              size="compact"
              onPress={() => onAdd(product.sku)}
              aria-label={t('store.addLabel', { product: product.name })}
              focusOnMount={product.autoFocus === 'add'}
            >
              <Icon icon={Plus} size={16} />
              <span className="hidden @3xs:inline">{t('store.add')}</span>
            </AppButton>
          )}
        </div>
      </div>
    </li>
  );
}
