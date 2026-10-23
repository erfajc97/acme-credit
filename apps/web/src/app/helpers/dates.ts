import { getActiveLocale, type Locale } from '@/app/i18n';

const formatters = new Map<Locale, Intl.DateTimeFormat>();

/** "21 oct 2026, 16:05" / "Oct 21, 2026, 4:05 PM", from an ISO instant of the API. */
export function formatDateTime(iso: string): string {
  const locale = getActiveLocale();
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    formatters.set(locale, formatter);
  }
  return formatter.format(new Date(iso));
}
