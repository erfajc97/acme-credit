import { DEFAULT_LOCALE, type Locale } from './locales';

/**
 * URL locales (Astro i18n routing, `prefixDefaultLocale: false`): es-MX pages live at `/`,
 * `/app`, …; en-US pages under `/en/`. One helper builds every localized link so islands, layouts
 * and the language switch agree.
 */
const PREFIX: Record<Locale, string> = { 'es-MX': '', 'en-US': '/en' };
const SWITCH_CODE: Record<Locale, string> = { 'es-MX': 'ES', 'en-US': 'EN' };

/** `/app` + en-US → `/en/app`; the home page keeps its trailing slash (`/en/`). */
export function localizePath(path: string, locale: Locale): string {
  const prefix = PREFIX[locale];
  if (!prefix) return path;
  return path === '/' ? `${prefix}/` : `${prefix}${path}`;
}

/** The locale a pathname belongs to and the page path without its prefix (no trailing slash). */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  const match = /^\/en(\/.*)?$/.exec(pathname);
  const locale: Locale = match ? 'en-US' : DEFAULT_LOCALE;
  const rest = match ? (match[1] ?? '/') : pathname;
  const path = rest.length > 1 ? rest.replace(/\/+$/, '') : '/';
  return { locale, path: path || '/' };
}

const LOCALES_IN_ORDER: readonly Locale[] = ['es-MX', 'en-US'];

/** Reciprocal hreflang links plus x-default (the es-MX page), WA6. */
export function alternateLinks(pathname: string): { hreflang: string; path: string }[] {
  const { path } = splitLocalePath(pathname);
  return [
    ...LOCALES_IN_ORDER.map((locale) => ({ hreflang: locale, path: localizePath(path, locale) })),
    { hreflang: 'x-default', path: localizePath(path, DEFAULT_LOCALE) },
  ];
}

/** ES | EN links to the same page (the switch never redirects on its own). */
export function localeSwitchLinks(pathname: string) {
  const current = splitLocalePath(pathname);
  return LOCALES_IN_ORDER.map((locale) => ({
    code: SWITCH_CODE[locale],
    lang: locale,
    href: localizePath(current.path, locale),
    isCurrent: locale === current.locale,
  }));
}
