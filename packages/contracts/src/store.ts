import { z } from 'zod';
import { idSchema } from './common';
import {
  AUTHORIZATION_STATUSES,
  DECLINE_REASONS,
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  orderLineSchema,
  type OrderLine,
} from './authorizations';
import { balanceCentsSchema, centsSchema } from './money';

/**
 * The in-wallet store (simulated merchants). The browser sends only SKUs and quantities; the
 * card network (acting as the merchant) prices them from this catalog, so a client can never
 * set its own price. Names are bilingual; the core stores the English name with each line.
 */
export const STORE_CATEGORIES = ['food', 'groceries', 'electronics', 'home'] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export interface StoreMerchant {
  id: string;
  name: string;
  mcc: string;
}

export const STORE_MERCHANTS = {
  taqueria: { id: 'taqueria', name: 'Taquería El Sol', mcc: '5812' },
  market: { id: 'market', name: 'Mercado Acme', mcc: '5411' },
  electro: { id: 'electro', name: 'Electro Hub', mcc: '5732' },
  casa: { id: 'casa', name: 'Casa & Co.', mcc: '5719' },
} as const satisfies Record<string, StoreMerchant>;

export type StoreMerchantId = keyof typeof STORE_MERCHANTS;

export interface StoreProduct {
  sku: string;
  merchant: StoreMerchantId;
  category: StoreCategory;
  name: { es: string; en: string };
  description: { es: string; en: string };
  priceCents: bigint;
}

export const STORE_CATALOG: readonly StoreProduct[] = [
  {
    sku: 'TAC-PASTOR',
    merchant: 'taqueria',
    category: 'food',
    name: { es: 'Orden de tacos al pastor', en: 'Al pastor tacos (order)' },
    description: {
      es: '5 tacos con piña y salsa verde',
      en: '5 tacos with pineapple and green salsa',
    },
    priceCents: 850n,
  },
  {
    sku: 'TAC-QUESA',
    merchant: 'taqueria',
    category: 'food',
    name: { es: 'Quesabirria', en: 'Quesabirria' },
    description: { es: '3 piezas con consomé', en: '3 pieces with consommé' },
    priceCents: 1150n,
  },
  {
    sku: 'TAC-HORCH',
    merchant: 'taqueria',
    category: 'food',
    name: { es: 'Agua de horchata', en: 'Horchata' },
    description: { es: '1 litro, hecha en casa', en: '1 liter, house made' },
    priceCents: 350n,
  },
  {
    sku: 'MKT-COFFEE',
    merchant: 'market',
    category: 'groceries',
    name: { es: 'Café de Chiapas 500 g', en: 'Chiapas coffee 500 g' },
    description: { es: 'Grano entero, tueste medio', en: 'Whole bean, medium roast' },
    priceCents: 1299n,
  },
  {
    sku: 'MKT-BASKET',
    merchant: 'market',
    category: 'groceries',
    name: { es: 'Despensa semanal', en: 'Weekly grocery basket' },
    description: { es: 'Frutas, verduras y básicos', en: 'Fruit, vegetables and staples' },
    priceCents: 6450n,
  },
  {
    sku: 'MKT-AVOCADO',
    merchant: 'market',
    category: 'groceries',
    name: { es: 'Aguacates (6)', en: 'Avocados (6)' },
    description: { es: 'Hass, listos para comer', en: 'Hass, ready to eat' },
    priceCents: 599n,
  },
  {
    sku: 'ELC-EARBUDS',
    merchant: 'electro',
    category: 'electronics',
    name: { es: 'Audífonos inalámbricos', en: 'Wireless earbuds' },
    description: { es: 'Cancelación de ruido, 24 h', en: 'Noise cancelling, 24 h battery' },
    priceCents: 7999n,
  },
  {
    sku: 'ELC-CHARGER',
    merchant: 'electro',
    category: 'electronics',
    name: { es: 'Cargador rápido 65 W', en: '65 W fast charger' },
    description: { es: 'USB-C, plegable', en: 'USB-C, foldable' },
    priceCents: 3499n,
  },
  {
    sku: 'ELC-SPEAKER',
    merchant: 'electro',
    category: 'electronics',
    name: { es: 'Bocina portátil', en: 'Portable speaker' },
    description: { es: 'Resistente al agua', en: 'Water resistant' },
    priceCents: 5900n,
  },
  {
    sku: 'HOM-LAMP',
    merchant: 'casa',
    category: 'home',
    name: { es: 'Lámpara de escritorio', en: 'Desk lamp' },
    description: { es: 'LED cálida, regulable', en: 'Warm dimmable LED' },
    priceCents: 2850n,
  },
  {
    sku: 'HOM-MUGS',
    merchant: 'casa',
    category: 'home',
    name: { es: 'Set de 4 tazas', en: 'Set of 4 mugs' },
    description: { es: 'Cerámica de Talavera', en: 'Talavera ceramic' },
    priceCents: 2400n,
  },
  {
    sku: 'HOM-PLANT',
    merchant: 'casa',
    category: 'home',
    name: { es: 'Planta de interior', en: 'Indoor plant' },
    description: { es: 'Monstera con maceta', en: 'Monstera with pot' },
    priceCents: 1999n,
  },
];

export function findProduct(sku: string): StoreProduct | undefined {
  return STORE_CATALOG.find((product) => product.sku === sku);
}

/** Browser → card network: a cart from ONE merchant (one card authorization per merchant). */
export const checkoutRequestSchema = z
  .object({
    cardToken: z.string().min(1).max(64),
    merchant: z.enum(Object.keys(STORE_MERCHANTS) as [StoreMerchantId, ...StoreMerchantId[]]),
    items: z
      .array(
        z
          .object({
            sku: z.string().min(1).max(32),
            quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_ORDER_LINES),
  })
  .strict();

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

/**
 * Browser → card network: void a hold (`POST /v1/purchases/:id/void`), store order or card
 * purchase. The card that made the purchase is the capability: knowing the id is not enough.
 */
export const voidPurchaseRequestSchema = checkoutRequestSchema.pick({ cardToken: true }).strict();

export type VoidPurchaseRequest = z.infer<typeof voidPurchaseRequestSchema>;

export const checkoutResultSchema = z
  .object({
    authorizationId: idSchema,
    status: z.enum(AUTHORIZATION_STATUSES),
    declineReason: z.enum(DECLINE_REASONS).nullable(),
    availableCents: balanceCentsSchema.nullable(),
    merchantName: z.string(),
    totalCents: centsSchema,
    lines: z.array(orderLineSchema),
  })
  .strict();

export type CheckoutResult = z.infer<typeof checkoutResultSchema>;

/** Prices a cart from the catalog; throws on an unknown SKU or a SKU of another merchant. */
export function priceCart(request: Pick<CheckoutRequest, 'merchant' | 'items'>): {
  lines: OrderLine[];
  totalCents: bigint;
} {
  let total = 0n;
  const lines = request.items.map(({ sku, quantity }) => {
    const product = findProduct(sku);
    if (!product || product.merchant !== request.merchant) {
      throw new Error(`Unknown SKU for merchant ${request.merchant}: ${sku}`);
    }
    total += product.priceCents * BigInt(quantity);
    return { sku, name: product.name.en, quantity, unitCents: product.priceCents.toString() };
  });
  return { lines, totalCents: total };
}
