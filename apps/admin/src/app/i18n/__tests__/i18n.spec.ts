import { keysOf } from '@acme/ui';
import { usedTranslationKeys } from '@acme/ui/used-keys';
import { resolve } from 'node:path';
import {
  DEFAULT_LOCALE,
  getActiveLocale,
  getT,
  LOCALES,
  setActiveLocale,
  t,
  type Locale,
} from '../index';

const ALL_LOCALES = Object.keys(LOCALES) as Locale[];

describe('admin i18n', () => {
  it('defaults to es-MX, with en-US as the alternative', () => {
    expect(DEFAULT_LOCALE).toBe('es-MX');
    expect(ALL_LOCALES).toEqual(['es-MX', 'en-US']);
    expect(getActiveLocale()).toBe('es-MX');
    expect(t('nav.purchases')).toBe('Compras');
  });

  it('t() follows the active locale the island set', () => {
    setActiveLocale('en-US');
    expect(t('nav.purchases')).toBe('Purchases');
    expect(getT('es-MX')('nav.auditLog')).toBe('Bitácora');
  });

  it('both locales define exactly the same keys (no locale falls behind)', () => {
    expect(keysOf(LOCALES['es-MX']).sort()).toEqual(keysOf(LOCALES['en-US']).sort());
  });

  it('defines every key the source uses, in every locale', () => {
    const used = usedTranslationKeys(resolve(__dirname, '../../..'));
    expect(used.length).toBeGreaterThan(0);
    for (const locale of ALL_LOCALES) {
      expect(keysOf(LOCALES[locale])).toEqual(expect.arrayContaining(used));
    }
  });
});

describe('copy keys held in data files (outside t() calls)', () => {
  it('every filter option and every key built from a variable has its copy in every locale', async () => {
    const [
      { STATUS_FILTER_OPTIONS: ACCOUNT_FILTERS },
      { STATUS_FILTER_OPTIONS: PURCHASE_FILTERS },
      { STATUS_FILTER_OPTIONS: PAYOUT_FILTERS },
    ] = await Promise.all([
      import('../../features/accounts/data'),
      import('../../features/purchases/data'),
      import('../../features/payouts/data'),
    ]);
    // Keys the dashboard builds from the trend's unit (`dashboard.trend.summary.${unit}`, …).
    const trendKeys = ['summary', 'captionLatest', 'captionAll'].flatMap((group) =>
      ['hour', 'day'].map((unit) => `dashboard.trend.${group}.${unit}`),
    );
    const keys = [
      ...ACCOUNT_FILTERS.map((option) => option.labelKey),
      ...PURCHASE_FILTERS.map((option) => option.labelKey),
      ...PAYOUT_FILTERS.map((option) => option.labelKey),
      ...trendKeys,
    ];
    for (const locale of ALL_LOCALES) {
      for (const key of keys) expect(getT(locale)(key), `${locale} ${key}`).not.toBe(key);
    }
  });
});
