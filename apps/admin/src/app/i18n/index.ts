import { createTranslator, type Translate } from '@acme/ui';
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales';

export { DEFAULT_LOCALE, LOCALES, type Locale } from './locales';

const TRANSLATORS: Record<Locale, Translate> = {
  'es-MX': createTranslator(LOCALES['es-MX']),
  'en-US': createTranslator(LOCALES['en-US']),
};

/** Fixed-locale translator: `.astro` frontmatter (`getT(locale)`) and tests. */
export function getT(locale: Locale): Translate {
  return TRANSLATORS[locale];
}

/**
 * The locale of the page the islands run on. The URL decides it (Astro i18n routing) and the page
 * passes it to every island root, which sets it here BEFORE its children render (AppProviders), so
 * the server HTML and the first client render use the same words (WA2). One page = one locale, so
 * a module value is enough; hooks, helpers and mutations translate with `t()` without threading
 * the locale through every call.
 */
let activeLocale: Locale = DEFAULT_LOCALE;

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

/** Translates in the active locale (W12). */
export const t: Translate = (key, params) => TRANSLATORS[activeLocale](key, params);
