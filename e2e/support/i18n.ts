// Copy comes from the apps' own dictionaries (never duplicated here) and amounts from the
// contract's own formatter, so a spec reads exactly what the customer and the operator read.
import { localizePath as localizeAdminPath } from '../../apps/admin/src/app/i18n/routing';
import { enUS as adminEnUS } from '../../apps/admin/src/app/i18n/locales/en-US';
import { esMX as adminEsMX } from '../../apps/admin/src/app/i18n/locales/es-MX';
import { localizePath as localizeWebPath } from '../../apps/web/src/app/i18n/routing';
import { enUS as webEnUS } from '../../apps/web/src/app/i18n/locales/en-US';
import { esMX as webEsMX } from '../../apps/web/src/app/i18n/locales/es-MX';
import { formatCents } from '../../packages/contracts/src/money';
import { optionalEnv } from './env';

export type AppLocale = 'es-MX' | 'en-US';

/**
 * The locale the golden paths run in. es-MX is both apps' default (the unprefixed routes:
 * `/app/store`); `E2E_LOCALE=en-US` runs the same flows on the `/en/...` pages.
 */
export const LOCALE: AppLocale = optionalEnv('E2E_LOCALE') === 'en-US' ? 'en-US' : 'es-MX';

interface Dictionary {
  [key: string]: string | Dictionary;
}

type Params = Record<string, string | number>;

function lookup(dictionary: Dictionary, key: string): string {
  let node: string | Dictionary | undefined = dictionary;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') throw new Error(`e2e: no copy for "${key}" in ${LOCALE}`);
  return node;
}

/** Same placeholder syntax as the apps' translator (`{name}`); a missing param is a spec bug. */
function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`e2e: missing param {${name}} in "${template}"`);
    return String(value);
  });
}

const WEB: Record<AppLocale, Dictionary> = { 'es-MX': webEsMX, 'en-US': webEnUS };
const ADMIN: Record<AppLocale, Dictionary> = { 'es-MX': adminEsMX, 'en-US': adminEnUS };

/** Customer app copy in the suite's locale. */
export const webT = (key: string, params?: Params): string =>
  interpolate(lookup(WEB[LOCALE], key), params);

/** Back-office copy in the suite's locale. */
export const adminT = (key: string, params?: Params): string =>
  interpolate(lookup(ADMIN[LOCALE], key), params);

/** A customer-app route in the suite's locale (`/app/store` or `/en/app/store`). */
export const webPath = (route: string): string => localizeWebPath(route, LOCALE);

/** A back-office route in the suite's locale. */
export const adminPath = (route: string): string => localizeAdminPath(route, LOCALE);

/** An amount of integer cents exactly as both apps print it in the suite's locale. */
export const money = (cents: bigint | string): string => formatCents(cents, LOCALE);
