import { getActiveLocale, type Locale } from '@/app/i18n';

type Style = 'dateTime' | 'date' | 'hour' | 'day';

const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  dateTime: { dateStyle: 'medium', timeStyle: 'short' },
  date: { dateStyle: 'medium' },
  hour: { hour: 'numeric' },
  day: { day: 'numeric', month: 'short' },
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(style: Style): Intl.DateTimeFormat {
  const locale: Locale = getActiveLocale();
  const id = `${locale}:${style}`;
  let formatter = formatters.get(id);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, OPTIONS[style]);
    formatters.set(id, formatter);
  }
  return formatter;
}

/** "21 oct 2026, 4:05 p.m." / "Oct 21, 2026, 4:05 PM", from an ISO instant of the API. */
export function formatDateTime(iso: string): string {
  return formatterFor('dateTime').format(new Date(iso));
}

/** "21 oct 2026" / "Oct 21, 2026": dense columns where the time adds nothing. */
export function formatDate(iso: string): string {
  return formatterFor('date').format(new Date(iso));
}

/** A chart's hour tick: "16 h" / "4 PM". */
export function formatHour(instant: number): string {
  return formatterFor('hour').format(new Date(instant));
}

/** A chart's day tick: "21 oct" / "Oct 21". */
export function formatDay(instant: number): string {
  return formatterFor('day').format(new Date(instant));
}
