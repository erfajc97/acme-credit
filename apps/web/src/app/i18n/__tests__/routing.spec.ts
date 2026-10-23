import { alternateLinks, localizePath, localeSwitchLinks, splitLocalePath } from '../routing';
import { localeStaticPaths } from '../staticPaths';

describe('localizePath (es-MX unprefixed, en-US under /en)', () => {
  it.each([
    ['/', 'es-MX', '/'],
    ['/', 'en-US', '/en/'],
    ['/app', 'es-MX', '/app'],
    ['/app', 'en-US', '/en/app'],
    ['/app/store', 'en-US', '/en/app/store'],
    ['/signin?returnTo=%2Fapp', 'en-US', '/en/signin?returnTo=%2Fapp'],
  ] as const)('%s in %s → %s', (path, locale, expected) => {
    expect(localizePath(path, locale)).toBe(expected);
  });
});

describe('splitLocalePath', () => {
  it.each([
    ['/', 'es-MX', '/'],
    ['/app/', 'es-MX', '/app'],
    ['/en', 'en-US', '/'],
    ['/en/', 'en-US', '/'],
    ['/en/app/checkout', 'en-US', '/app/checkout'],
    // "/english" is not the /en prefix.
    ['/english', 'es-MX', '/english'],
  ] as const)('%s → %s %s', (pathname, locale, path) => {
    expect(splitLocalePath(pathname)).toEqual({ locale, path });
  });
});

describe('alternateLinks and the locale switch', () => {
  it('lists the same page in both locales plus x-default (the es-MX page)', () => {
    expect(alternateLinks('/en/app')).toEqual([
      { hreflang: 'es-MX', path: '/app' },
      { hreflang: 'en-US', path: '/en/app' },
      { hreflang: 'x-default', path: '/app' },
    ]);
  });

  it('links ES and EN to the same page, marking the current one', () => {
    expect(localeSwitchLinks('/app/store')).toEqual([
      { code: 'ES', lang: 'es-MX', href: '/app/store', isCurrent: true },
      { code: 'EN', lang: 'en-US', href: '/en/app/store', isCurrent: false },
    ]);
    expect(localeSwitchLinks('/en/').map((link) => [link.href, link.isCurrent])).toEqual([
      ['/', false],
      ['/en/', true],
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
