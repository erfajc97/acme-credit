import { isPlainClick, orderHref, orderUrl, readOrderParam } from '@/app/helpers/orderParam';

const ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('readOrderParam (the one parser of ?order=)', () => {
  it('reads an order id from the query', () => {
    expect(readOrderParam(`?order=${ID}`)).toBe(ID);
    expect(readOrderParam(`?tab=x&order=${ID}`)).toBe(ID);
  });

  it('ignores a missing, empty or malformed id (a hand-edited link never opens a broken sheet)', () => {
    expect(readOrderParam('')).toBeNull();
    expect(readOrderParam('?order=')).toBeNull();
    expect(readOrderParam('?order=not-an-id')).toBeNull();
    expect(readOrderParam(`?order=${ID}x`)).toBeNull();
  });
});

describe('orderHref', () => {
  it('is a query-only link that the one parser reads back', () => {
    expect(orderHref(ID)).toBe(`?order=${ID}`);
    expect(readOrderParam(orderHref(ID))).toBe(ID);
  });
});

describe('orderUrl', () => {
  it('adds the order to the current address, keeping its other parameters and hash', () => {
    expect(orderUrl('http://localhost/en/app/activity?tab=x#top', ID)).toBe(
      `/en/app/activity?tab=x&order=${ID}#top`,
    );
  });

  it('replaces an order already there and removes it on close', () => {
    expect(
      orderUrl(`http://localhost/app/activity?order=${ID}`, 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e'),
    ).toBe('/app/activity?order=b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e');
    expect(orderUrl(`http://localhost/app/activity?order=${ID}`, null)).toBe('/app/activity');
    expect(orderUrl(`http://localhost/app/activity?tab=x&order=${ID}`, null)).toBe(
      '/app/activity?tab=x',
    );
  });
});

describe('isPlainClick', () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  it('opens in place only on a plain primary click; any modifier or other button is left to the browser', () => {
    expect(isPlainClick(click)).toBe(true);
    expect(isPlainClick({ ...click, button: 1 })).toBe(false);
    expect(isPlainClick({ ...click, metaKey: true })).toBe(false);
    expect(isPlainClick({ ...click, ctrlKey: true })).toBe(false);
    expect(isPlainClick({ ...click, shiftKey: true })).toBe(false);
    expect(isPlainClick({ ...click, altKey: true })).toBe(false);
  });
});
