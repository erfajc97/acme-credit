import type { StoreCategory } from '@acme/contracts';
import { Icon } from '@/app/components/UI/Icon';
import { CATEGORY_TILE } from '../data';

interface CategoryTileProps {
  category: StoreCategory;
}

/** The product image's placeholder: a flat category icon on its soft tint, in the image's 16:10 box. */
export function CategoryTile({ category }: CategoryTileProps) {
  const tile = CATEGORY_TILE[category];
  return (
    <div
      aria-hidden="true"
      data-testid="product-fallback"
      className={`flex aspect-16/10 w-full items-center justify-center text-fg ${tile.tint}`}
    >
      <span className="flex size-16 items-center justify-center rounded-full border-[1.6px] border-ink bg-surface-raised">
        <Icon icon={tile.icon} size={40} />
      </span>
    </div>
  );
}
