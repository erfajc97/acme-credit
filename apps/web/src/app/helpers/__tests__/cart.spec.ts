import { setActiveLocale } from '@/app/i18n';
import {
  cartLines,
  cartSummary,
  checkoutItems,
  exceedsAvailable,
  itemCountLabel,
  productName,
} from '../cart';

describe('cart math (display only: the network prices the order)', () => {
  afterEach(() => setActiveLocale('es-MX'));

  it('prices each line from the catalog in integer cents and keeps only that merchant', () => {
    const lines = cartLines('taqueria', {
      'TAC-PASTOR': 3,
      'TAC-HORCH': 1,
      'MKT-COFFEE': 2,
      'NOPE-1': 4,
    });
    expect(lines.map((line) => [line.sku, line.quantity, line.lineCents])).toEqual([
      ['TAC-PASTOR', 3, 2550n],
      ['TAC-HORCH', 1, 350n],
    ]);
    expect(cartSummary(lines)).toEqual({ itemCount: 4, totalCents: 2900n });
    expect(checkoutItems(lines)).toEqual([
      { sku: 'TAC-PASTOR', quantity: 3 },
      { sku: 'TAC-HORCH', quantity: 1 },
    ]);
  });

  it('an empty cart (or no merchant) has no lines and a zero total', () => {
    expect(cartLines(null, { 'TAC-PASTOR': 1 })).toEqual([]);
    expect(cartSummary([])).toEqual({ itemCount: 0, totalCents: 0n });
  });

  it('warns only when the total is above what is available (equal still fits)', () => {
    expect(exceedsAvailable(34_000n, '34000')).toBe(false);
    expect(exceedsAvailable(34_001n, '34000')).toBe(true);
  });

  it('names products and counts items in the page locale', () => {
    expect(productName('ELC-EARBUDS')).toBe('Audífonos inalámbricos');
    expect(itemCountLabel(1)).toBe('1 artículo');
    expect(itemCountLabel(2)).toBe('2 artículos');
    setActiveLocale('en-US');
    expect(productName('ELC-EARBUDS')).toBe('Wireless earbuds');
    expect(itemCountLabel(1)).toBe('1 item');
    expect(productName('UNKNOWN', 'Fallback name')).toBe('Fallback name');
  });
});
