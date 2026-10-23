import type { Locale } from './locales';

/**
 * Every page is one source under `src/pages/[...lang]/`, generated twice: es-MX at the root
 * (`lang` undefined → `/app`) and en-US under `/en` (`/en/app`). The page reads `locale` from props.
 */
export function localeStaticPaths(): {
  params: { lang: string | undefined };
  props: { locale: Locale };
}[] {
  return [
    { params: { lang: undefined }, props: { locale: 'es-MX' } },
    { params: { lang: 'en' }, props: { locale: 'en-US' } },
  ];
}
