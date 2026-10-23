import { DEFAULT_LOCALE, setActiveLocale, t } from '@/app/i18n';
import { activityTitle } from '../helpers/activityTitle';

const row = (
  type: Parameters<typeof activityTitle>[0]['type'],
  merchantName: string | null = null,
  itemCount = 0,
) => ({
  type,
  merchantName,
  itemCount,
  // The API's English prose must never reach the screen, whatever it says.
  description: 'Purchase at Somewhere Else · 99 items',
});

describe('activityTitle (structured fields, never the API English prose)', () => {
  afterEach(() => setActiveLocale(DEFAULT_LOCALE));

  it('a deposit, payment or collateral line shows only its translated type', () => {
    expect(activityTitle(row('deposit'))).toBe(t('activity.type.deposit'));
    expect(activityTitle(row('repayment'))).toBe('Pago');
    expect(activityTitle(row('collateral_released'))).toBe(t('activity.type.collateral_released'));
  });

  it('a purchase shows its merchant and pluralizes the units in the page language', () => {
    expect(activityTitle(row('purchase', 'Taquería El Sol', 2))).toBe(
      'Compra · Taquería El Sol · 2 artículos',
    );
    expect(activityTitle(row('purchase', 'Taquería El Sol', 1))).toBe(
      'Compra · Taquería El Sol · 1 artículo',
    );
    setActiveLocale('en-US');
    expect(activityTitle(row('purchase', 'Corner Grocery', 12))).toBe(
      'Purchase · Corner Grocery · 12 items',
    );
  });

  it('a card purchase without lines shows the merchant; a purchase without a merchant falls back to the type', () => {
    expect(activityTitle(row('purchase', 'Corner Grocery', 0))).toBe('Compra · Corner Grocery');
    expect(activityTitle(row('purchase', null, 0))).toBe('Compra');
    expect(activityTitle(row('purchase', '', 3))).toBe('Compra');
  });
});
