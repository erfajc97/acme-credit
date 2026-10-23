import type { Locale } from './locales';

/**
 * Every page is one source under `src/pages/[...lang]/`, generated twice: es-MX at the root
 * (`lang` undefined → `/dashboard`) and en-US under `/en` (`/en/dashboard`). The page reads
 * `locale` from its props.
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
