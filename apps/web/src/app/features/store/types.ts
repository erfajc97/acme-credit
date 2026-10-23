import type { StoreCategory } from '@acme/contracts';

/** A catalog product as the store grid shows it, in the page locale. */
export interface ProductView {
  sku: string;
  category: StoreCategory;
  merchantName: string;
  name: string;
  description: string;
  price: string;
  /** The product illustration (`/products/<SKU>.svg`); the category tile stands in when it fails. */
  imageSrc: string;
  /** Only the first row loads eagerly; the rest waits until scrolled near (W13). */
  imageLoading: 'eager' | 'lazy';
  /** In the cart already: the card shows the stepper instead of "Add". */
  quantity: number;
  /** Which control takes focus when it mounts after the customer's own add/remove (else none). */
  autoFocus: ProductFocusTarget | null;
}

/** "stepper": the "+" that replaced "Add"; "add": the "Add" that replaced the stepper. */
export type ProductFocusTarget = 'stepper' | 'add';

/** A cart line as the cart panel shows it. */
export interface CartLineView {
  sku: string;
  name: string;
  quantity: number;
  total: string;
}

export type { CategoryFilter, MerchantFilter } from './data';
