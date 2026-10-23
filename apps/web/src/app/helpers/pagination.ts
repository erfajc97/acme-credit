import type { PaginatorLabels } from '@acme/ui';
import { getActiveLocale, t } from '@/app/i18n';
import { pageRange } from './pageParam';

/** The words of a Paginator (W12): `nav` names the landmark of each list on the screen. */
export function paginatorLabels(nav: string): PaginatorLabels {
  return {
    nav,
    previous: t('common.pagination.previous'),
    next: t('common.pagination.next'),
    page: (page) => t('common.pagination.page', { page }),
    status: (page, total) => t('common.pagination.status', { page, total }),
  };
}

/** "Showing 11–20 of 47", or null when the page shows no rows (or has not arrived yet). */
export function pageSummary(
  data: { page: number; pageSize: number; total: number } | undefined,
): string | null {
  const range = data ? pageRange(data) : null;
  if (!data || !range) return null;
  const count = new Intl.NumberFormat(getActiveLocale());
  return t('common.pagination.summary', {
    from: count.format(range.from),
    to: count.format(range.to),
    total: count.format(data.total),
  });
}
