import type { UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { formatCount } from '@/app/helpers/money';
import { pageRange } from '@/app/helpers/pagination';
import { t } from '@/app/i18n';

/** One numbered page as the API answers it (packages/contracts `pageSchema`). */
export interface ListPage<Item> {
  items: Item[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PagedListView<Row> {
  rows: Row[];
  /** First load only: the skeleton (W4: gated by isLoading, never isPending). */
  isLoading: boolean;
  /** Nothing to show because the read failed. */
  isError: boolean;
  /** The list has no rows at all (not just this page). */
  isEmpty: boolean;
  /** An old link past the end of a list that shrank: the list has rows, this page has none. */
  isOutOfRange: boolean;
  /** Another page or filter is loading: the previous rows stay on screen, marked as updating. */
  isUpdating: boolean;
  retry: () => void;
  isRetrying: boolean;
  /** The page the address asks for (shown as current while it loads). */
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  /** "Showing 11–20 of 47", announced politely (W10). */
  rangeMessage: string;
}

function rangeMessageOf<Item>(data: ListPage<Item>): string {
  const range = pageRange({ ...data, itemCount: data.items.length });
  if (!range) return t('common.pageOutOfRange', { totalPages: formatCount(data.totalPages) });
  return t('common.pageRange', {
    from: formatCount(range.from),
    to: formatCount(range.to),
    total: formatCount(range.total),
  });
}

/**
 * The states of a numbered list (W13) from the query of one page: a skeleton on the first load,
 * the empty state, an error with retry, or the page's rows with the range and the page count for
 * the Paginator. While another page or filter loads (placeholderData) the old rows stay, marked
 * as updating. The page itself lives in the address: `setPage` is the list's URL writer.
 */
export function usePagedList<Item, Row>(
  query: UseQueryResult<ListPage<Item>>,
  toRow: (item: Item) => Row,
  { page, setPage }: { page: number; setPage: (page: number) => void },
): PagedListView<Row> {
  const { data } = query;
  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data, toRow]);
  const hasRows = rows.length > 0;
  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError && !data,
    isEmpty: data !== undefined && data.total === 0,
    isOutOfRange: data !== undefined && data.total > 0 && !hasRows,
    isUpdating: query.isPlaceholderData,
    // refetch never rejects: failures land in the query state, shown by the error branch.
    retry: () => void query.refetch(),
    isRetrying: query.isFetching,
    page,
    totalPages: data?.totalPages ?? 1,
    setPage,
    rangeMessage: data ? rangeMessageOf(data) : '',
  };
}
