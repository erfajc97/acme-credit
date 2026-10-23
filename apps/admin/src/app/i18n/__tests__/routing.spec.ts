import { localizePath, localeSwitchLinks, splitLocalePath } from '../routing';
import { localeStaticPaths } from '../staticPaths';

describe('localizePath (es-MX unprefixed, en-US under /en)', () => {
  it.each([
    ['/', 'es-MX', '/'],
    ['/', 'en-US', '/en/'],
    ['/dashboard', 'es-MX', '/dashboard'],
    ['/dashboard', 'en-US', '/en/dashboard'],
    ['/accounts/view?id=a-1', 'en-US', '/en/accounts/view?id=a-1'],
    ['/purchases?status=DECLINED', 'en-US', '/en/purchases?status=DECLINED'],
  ] as const)('%s in %s → %s', (path, locale, expected) => {
    expect(localizePath(path, locale)).toBe(expected);
  });
});

describe('splitLocalePath', () => {
  it.each([
    ['/', 'es-MX', '/'],
    ['/purchases/', 'es-MX', '/purchases'],
    ['/en', 'en-US', '/'],
    ['/en/', 'en-US', '/'],
    ['/en/accounts/view', 'en-US', '/accounts/view'],
    // "/entries" is not the /en prefix.
    ['/entries', 'es-MX', '/entries'],
  ] as const)('%s → %s %s', (pathname, locale, path) => {
    expect(splitLocalePath(pathname)).toEqual({ locale, path });
  });
});

describe('the locale switch', () => {
  it('links ES and EN to the same page, marking the current one', () => {
    expect(localeSwitchLinks('/purchases')).toEqual([
      { code: 'ES', lang: 'es-MX', href: '/purchases', isCurrent: true },
      { code: 'EN', lang: 'en-US', href: '/en/purchases', isCurrent: false },
    ]);
    expect(localeSwitchLinks('/en/ledger').map((link) => [link.href, link.isCurrent])).toEqual([
      ['/ledger', false],
      ['/en/ledger', true],
    ]);
  });
});

describe('localeStaticPaths (one page source, two locales)', () => {
  it('builds es-MX at the root and en-US under /en', () => {
    expect(localeStaticPaths()).toEqual([
      { params: { lang: undefined }, props: { locale: 'es-MX' } },
      { params: { lang: 'en' }, props: { locale: 'en-US' } },
    ]);
  });
});
