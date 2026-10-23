import { describe, expect, it } from 'vitest';
import {
  checkoutRequestSchema,
  findProduct,
  linesTotalCents,
  networkAuthorizationRequestSchema,
  priceCart,
  STORE_CATALOG,
  STORE_MERCHANTS,
  voidPurchaseRequestSchema,
} from '../index';

describe('store catalog', () => {
  it('has unique SKUs, known merchants and positive prices', () => {
    expect(new Set(STORE_CATALOG.map((p) => p.sku)).size).toBe(STORE_CATALOG.length);
    for (const product of STORE_CATALOG) {
      expect(STORE_MERCHANTS[product.merchant]).toBeDefined();
      expect(product.priceCents > 0n).toBe(true);
      expect(product.name.es && product.name.en).toBeTruthy();
    }
    expect(findProduct('TAC-PASTOR')?.priceCents).toBe(850n);
    expect(findProduct('NOPE')).toBeUndefined();
  });

  it('prices a cart from the catalog, never from the client', () => {
    const priced = priceCart({
      merchant: 'taqueria',
      items: [
        { sku: 'TAC-PASTOR', quantity: 2 },
        { sku: 'TAC-HORCH', quantity: 1 },
      ],
    });
    expect(priced.totalCents).toBe(2050n);
    expect(priced.lines[0]).toEqual({
      sku: 'TAC-PASTOR',
      name: 'Al pastor tacos (order)',
      quantity: 2,
      unitCents: '850',
    });
    expect(linesTotalCents(priced.lines)).toBe(priced.totalCents);
  });

  it('refuses an unknown SKU or a SKU of another merchant', () => {
    expect(() =>
      priceCart({ merchant: 'taqueria', items: [{ sku: 'NOPE', quantity: 1 }] }),
    ).toThrow();
    expect(() =>
      priceCart({ merchant: 'taqueria', items: [{ sku: 'ELC-EARBUDS', quantity: 1 }] }),
    ).toThrow();
  });

  it('validates checkout requests: quantity 1..20, 1..20 lines, known merchant', () => {
    const base = {
      cardToken: 'card_x',
      merchant: 'market',
      items: [{ sku: 'MKT-COFFEE', quantity: 20 }],
    };
    expect(checkoutRequestSchema.safeParse(base).success).toBe(true);
    expect(
      checkoutRequestSchema.safeParse({ ...base, items: [{ sku: 'MKT-COFFEE', quantity: 21 }] })
        .success,
    ).toBe(false);
    expect(
      checkoutRequestSchema.safeParse({ ...base, items: [{ sku: 'MKT-COFFEE', quantity: 0 }] })
        .success,
    ).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, merchant: 'nope' }).success).toBe(false);
  });

  it('accepts optional priced lines on the network authorization request', () => {
    const request = {
      cardToken: 'card_x',
      amountCents: '850',
      merchant: { name: 'Taquería El Sol', mcc: '5812' },
      items: [
        { sku: 'TAC-PASTOR', name: 'Al pastor tacos (order)', quantity: 1, unitCents: '850' },
      ],
    };
    expect(networkAuthorizationRequestSchema.safeParse(request).success).toBe(true);
    const { items: _items, ...plain } = request;
    expect(networkAuthorizationRequestSchema.safeParse(plain).success).toBe(true);
  });
});

describe('voidPurchaseRequestSchema (the card is the capability to void)', () => {
  it('takes the card token with the same cap as a checkout (G12): 64 passes, 65 and empty fail', () => {
    expect(voidPurchaseRequestSchema.safeParse({ cardToken: 'c'.repeat(64) }).success).toBe(true);
    expect(voidPurchaseRequestSchema.safeParse({ cardToken: 'c'.repeat(65) }).success).toBe(false);
    expect(voidPurchaseRequestSchema.safeParse({ cardToken: '' }).success).toBe(false);
    expect(checkoutRequestSchema.shape.cardToken).toBe(voidPurchaseRequestSchema.shape.cardToken);
  });

  it('requires the token and refuses unknown keys', () => {
    expect(voidPurchaseRequestSchema.safeParse({}).success).toBe(false);
    expect(
      voidPurchaseRequestSchema.safeParse({ cardToken: 'tok_card_1', amountCents: '1' }).success,
    ).toBe(false);
  });
});
