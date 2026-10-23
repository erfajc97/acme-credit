import { STORE_MERCHANTS, type StoreCategory, type StoreMerchantId } from '@acme/contracts';
import { House, Headphones, ShoppingBasket, UtensilsCrossed, type LucideIcon } from 'lucide-react';

/** The word of each category. Keys, not copy (W12). */
export const CATEGORY_LABEL: Record<StoreCategory, string> = {
  food: 'store.category.food',
  groceries: 'store.category.groceries',
  electronics: 'store.category.electronics',
  home: 'store.category.home',
};

/**
 * Each category's icon tile: a flat icon on a soft tint (docs/brand.md › Imagery: no photos, no
 * emoji). Three brand tints plus the neutral one, never a rainbow.
 */
export const CATEGORY_TILE: Record<StoreCategory, { icon: LucideIcon; tint: string }> = {
  food: { icon: UtensilsCrossed, tint: 'bg-cream' },
  groceries: { icon: ShoppingBasket, tint: 'bg-mint' },
  electronics: { icon: Headphones, tint: 'bg-lavender' },
  home: { icon: House, tint: 'bg-neutral-soft' },
};

/**
 * Product illustrations ship with the app under public/products/, named by SKU (16:10, 640 × 400).
 * Local files only (CSP img-src 'self'); a missing one falls back to the category tile.
 */
export function productImageSrc(sku: string): string {
  return `/products/${encodeURIComponent(sku)}.svg`;
}

/** Images of the first grid row (up to 3 columns) are above the fold: they load eagerly. */
export const EAGER_PRODUCT_IMAGES = 3;

export const ALL = 'all';
export type MerchantFilter = typeof ALL | StoreMerchantId;
export type CategoryFilter = typeof ALL | StoreCategory;

export const MERCHANT_IDS = Object.keys(STORE_MERCHANTS) as StoreMerchantId[];
