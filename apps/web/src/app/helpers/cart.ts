import {
  findProduct,
  STORE_CATALOG,
  type StoreCategory,
  type StoreMerchantId,
} from '@acme/contracts';
import { getActiveLocale, t } from '@/app/i18n';

/** One priced line of the cart, for display. The card network prices the real order (contract). */
export interface CartLine {
  sku: string;
  category: StoreCategory;
  name: string;
  description: string;
  quantity: number;
  unitCents: bigint;
  lineCents: bigint;
}

/** The catalog copy is bilingual: es for es-MX, en for en-US. */
function catalogLanguage(): 'es' | 'en' {
  return getActiveLocale() === 'en-US' ? 'en' : 'es';
}

/** A product's name in the page locale; `fallback` (the name stored with an order) otherwise. */
export function productName(sku: string, fallback = sku): string {
  return findProduct(sku)?.name[catalogLanguage()] ?? fallback;
}

/**
 * The cart's lines in catalog order, only for products of the cart's merchant (a stale SKU from
 * an older catalog is dropped instead of breaking the screen).
 */
export function cartLines(
  merchant: StoreMerchantId | null,
  quantities: Record<string, number>,
): CartLine[] {
  if (merchant === null) return [];
  const language = catalogLanguage();
  return STORE_CATALOG.filter(
    (product) => product.merchant === merchant && quantities[product.sku],
  ).map((product) => {
    const quantity = quantities[product.sku] ?? 0;
    return {
      sku: product.sku,
      category: product.category,
      name: product.name[language],
      description: product.description[language],
      quantity,
      unitCents: product.priceCents,
      lineCents: product.priceCents * BigInt(quantity),
    };
  });
}

/** Item count and total in integer cents (P1): bigint arithmetic, never a float. */
export function cartSummary(lines: readonly CartLine[]): { itemCount: number; totalCents: bigint } {
  return lines.reduce(
    (summary, line) => ({
      itemCount: summary.itemCount + line.quantity,
      totalCents: summary.totalCents + line.lineCents,
    }),
    { itemCount: 0, totalCents: 0n },
  );
}

/** What the browser sends: SKUs and quantities only (checkoutRequestSchema). */
export function checkoutItems(lines: readonly CartLine[]): { sku: string; quantity: number }[] {
  return lines.map(({ sku, quantity }) => ({ sku, quantity }));
}

/** The checkout warns above "available"; equal still fits. The network's decline is the real rule. */
export function exceedsAvailable(totalCents: bigint, availableCents: string): boolean {
  return totalCents > BigInt(availableCents);
}

/** "1 artículo" / "3 artículos". */
export function itemCountLabel(count: number): string {
  return count === 1 ? t('store.cart.itemsOne') : t('store.cart.itemsOther', { count });
}
