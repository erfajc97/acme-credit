import { linesTotalCents } from '@acme/contracts';
import { setActiveLocale } from '@/app/i18n';
import { ACCOUNT_ID, adminAuthorizationFixture, STORE_ITEMS } from '@/test/fixtures';
import { lineSubtotalCents, toOrderLineViews, toPurchaseRow } from '../orders';

/** es-MX shows USD amounts as "USD 1,250.00", with the no-break space Intl puts after the code. */
const NBSP = String.fromCodePoint(0xa0);
const usd = (amount: string) => `USD${NBSP}${amount}`;

describe('lineSubtotalCents (qty × unit, integer cents)', () => {
  it('multiplies the unit price by the quantity, exactly', () => {
    expect(lineSubtotalCents({ sku: 'a', name: 'A', quantity: 3, unitCents: '1225' })).toBe(3675n);
    expect(lineSubtotalCents({ sku: 'b', name: 'B', quantity: 1, unitCents: '4999' })).toBe(4999n);
    // The largest line the contract allows stays exact (no float on the way).
    expect(lineSubtotalCents({ sku: 'c', name: 'C', quantity: 20, unitCents: '99999999' })).toBe(
      1_999_999_980n,
    );
  });

  it('the subtotals add up to the total the core checks against the authorized amount', () => {
    const sum = STORE_ITEMS.reduce((total, line) => total + lineSubtotalCents(line), 0n);
    expect(sum).toBe(linesTotalCents(STORE_ITEMS));
    expect(sum).toBe(9374n);
  });
});

describe('order line views', () => {
  it('formats unit and subtotal in the page locale (es-MX by default)', () => {
    expect(toOrderLineViews(STORE_ITEMS)[1]).toEqual({
      key: '1:pan-dulce',
      quantity: 3,
      name: 'Concha',
      unit: usd('12.25'),
      subtotal: usd('36.75'),
    });
  });

  it('switches to US formats on English pages; no lines → no views', () => {
    setActiveLocale('en-US');
    expect(toOrderLineViews(STORE_ITEMS).map((line) => [line.unit, line.subtotal])).toEqual([
      ['$3.50', '$7.00'],
      ['$12.25', '$36.75'],
      ['$49.99', '$49.99'],
    ]);
    expect(toOrderLineViews([])).toEqual([]);
  });
});

describe('purchase rows', () => {
  it('a store order on hold: customer linked to the account, status in words, nothing posted yet', () => {
    const row = toPurchaseRow(adminAuthorizationFixture());
    expect(row).toMatchObject({
      customer: { name: 'Ada Lovelace', email: 'ada@example.test' },
      accountHref: `/accounts/view?id=${ACCOUNT_ID}`,
      merchant: 'Taquería El Sol',
      mcc: '5812',
      statusKey: 'status.authorization.APPROVED',
      tone: 'warning',
      reasonKey: null,
      amount: usd('93.74'),
      captured: null,
    });
    expect(row.lines).toHaveLength(3);
  });

  it('a decline says why in words; a posted purchase shows what was captured', () => {
    const declined = toPurchaseRow(
      adminAuthorizationFixture({ status: 'DECLINED', declineReason: 'card_frozen' }),
    );
    expect(declined).toMatchObject({
      statusKey: 'status.authorization.DECLINED',
      tone: 'danger',
      reasonKey: 'declineReason.card_frozen',
    });
    const posted = toPurchaseRow(
      adminAuthorizationFixture({ status: 'CAPTURED', capturedCents: '9374' }),
    );
    expect(posted.captured).toBe(usd('93.74'));
  });

  it('an unknown card has no customer and no account to link', () => {
    const row = toPurchaseRow(
      adminAuthorizationFixture({ customer: null, accountId: null, items: [] }),
    );
    expect(row).toMatchObject({ customer: null, accountHref: null, lines: [] });
  });

  it('links the account in the page locale', () => {
    setActiveLocale('en-US');
    expect(toPurchaseRow(adminAuthorizationFixture()).accountHref).toBe(
      `/en/accounts/view?id=${ACCOUNT_ID}`,
    );
  });
});
