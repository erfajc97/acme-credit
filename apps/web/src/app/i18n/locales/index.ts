import type { Messages } from '@acme/ui';
import { enUS } from './en-US';
import { esMX } from './es-MX';

/** es-MX is the default (docs/brand.md › Voice); en-US the alternative. */
export const DEFAULT_LOCALE = 'es-MX';

export const LOCALES = { 'es-MX': esMX, 'en-US': enUS } satisfies Record<string, Messages>;

export type Locale = keyof typeof LOCALES;
