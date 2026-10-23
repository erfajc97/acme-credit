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

describe('web i18n', () => {
  afterEach(() => setActiveLocale(DEFAULT_LOCALE));

  it('defaults to es-MX, with en-US as the alternative', () => {
    expect(DEFAULT_LOCALE).toBe('es-MX');
    expect(ALL_LOCALES).toEqual(['es-MX', 'en-US']);
    expect(getActiveLocale()).toBe('es-MX');
    expect(t('nav.store')).toBe('Tienda');
  });

  it('t() follows the active locale the island set', () => {
    setActiveLocale('en-US');
    expect(t('nav.store')).toBe('Store');
    expect(getT('es-MX')('nav.store')).toBe('Tienda');
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

  it.each(ALL_LOCALES)(
    'keeps every %s title and description inside the SEO lengths (WA6)',
    (locale) => {
      const translate = getT(locale);
      const titles = [
        'homeTitle',
        'signInTitle',
        'signUpTitle',
        'appTitle',
        'cardTitle',
        'storeTitle',
        'checkoutTitle',
        'activityTitle',
        'profileTitle',
      ];
      for (const key of titles)
        expect(translate(`meta.${key}`).length, key).toBeLessThanOrEqual(60);
      for (const key of [
        'homeDescription',
        'signInDescription',
        'signUpDescription',
        'privateDescription',
      ]) {
        const length = translate(`meta.${key}`).length;
        expect(length, key).toBeGreaterThanOrEqual(100);
        expect(length, key).toBeLessThanOrEqual(155);
      }
    },
  );
});

describe('copy keys held in data files (outside t() calls)', () => {
  it('every decline reason, activity type and store category has its copy in every locale', async () => {
    const [{ DECLINE_COPY }, { ACTIVITY_TYPE_LABEL }, { DECLINE_SHORT }, { CATEGORY_LABEL }] =
      await Promise.all([
        import('../../features/checkout/data'),
        import('../../features/activity/data'),
        import('../../helpers/orders'),
        import('../../features/store/data'),
      ]);
    const keys = [
      ...Object.values(DECLINE_COPY),
      ...Object.values(DECLINE_SHORT),
      ...Object.values(ACTIVITY_TYPE_LABEL),
      ...Object.values(CATEGORY_LABEL),
    ];
    for (const locale of ALL_LOCALES) {
      for (const key of keys) expect(getT(locale)(key), `${locale} ${key}`).not.toBe(key);
    }
  });
});
