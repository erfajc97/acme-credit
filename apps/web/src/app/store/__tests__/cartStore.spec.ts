import { MAX_LINE_QUANTITY } from '@acme/contracts';
import { CART_STORAGE_KEY, useCartStore } from '../cartStore';

const cart = () => useCartStore.getState();

describe('cart store (one merchant per cart, persisted for the tab)', () => {
  it('adds from one merchant and counts repeated adds as quantity', () => {
    expect(cart().add('TAC-PASTOR')).toBe('added');
    expect(cart().add('TAC-PASTOR')).toBe('added');
    expect(cart().add('TAC-HORCH')).toBe('added');
    expect(cart()).toMatchObject({
      merchant: 'taqueria',
      quantities: { 'TAC-PASTOR': 2, 'TAC-HORCH': 1 },
    });
  });

  it('asks before mixing merchants and changes nothing until the customer agrees', () => {
    cart().add('TAC-PASTOR');
    expect(cart().add('ELC-CHARGER')).toBe('conflict');
    expect(cart()).toMatchObject({ merchant: 'taqueria', quantities: { 'TAC-PASTOR': 1 } });
    cart().startNewCart('ELC-CHARGER');
    expect(cart()).toMatchObject({ merchant: 'electro', quantities: { 'ELC-CHARGER': 1 } });
  });

  it('keeps quantities inside 1..20: 20 is kept, 21 is capped, 0 removes the line', () => {
    cart().add('MKT-COFFEE');
    cart().setQuantity('MKT-COFFEE', MAX_LINE_QUANTITY);
    expect(cart().quantities['MKT-COFFEE']).toBe(20);
    cart().add('MKT-COFFEE');
    expect(cart().quantities['MKT-COFFEE']).toBe(20);
    cart().setQuantity('MKT-COFFEE', MAX_LINE_QUANTITY + 1);
    expect(cart().quantities['MKT-COFFEE']).toBe(20);
    cart().setQuantity('MKT-COFFEE', 0);
    expect(cart()).toMatchObject({ merchant: null, quantities: {} });
  });

  it('removing the last line or clearing empties the merchant too', () => {
    cart().add('HOM-LAMP');
    cart().add('HOM-MUGS');
    cart().remove('HOM-LAMP');
    expect(cart()).toMatchObject({ merchant: 'casa', quantities: { 'HOM-MUGS': 1 } });
    cart().clear();
    expect(cart()).toMatchObject({ merchant: null, quantities: {} });
  });

  it('ignores a SKU that is not in the catalog', () => {
    expect(cart().add('FAKE-SKU')).toBe('ignored');
    cart().setQuantity('FAKE-SKU', 3);
    expect(cart()).toMatchObject({ merchant: null, quantities: {} });
  });

  it('persists in sessionStorage (no secrets: SKUs and quantities only)', () => {
    cart().add('TAC-QUESA');
    const stored = JSON.parse(window.sessionStorage.getItem(CART_STORAGE_KEY) ?? '{}') as {
      state: unknown;
    };
    expect(stored.state).toEqual({ merchant: 'taqueria', quantities: { 'TAC-QUESA': 1 } });
  });
});
