import type { PaginatorLabels } from '@acme/ui';
import { useState } from 'react';
import type { ListPageParam } from '@/app/helpers/pageParam';
import { pageSummary, paginatorLabels } from '@/app/helpers/pagination';
import { usePageParam } from './usePageParam';

/** What a list's pager shows: the Paginator's props plus "Showing 11–20 of 47". */
export interface PagerView {
  page: number;
  totalPages: number;
  summary: string | null;
  /** The next page is on its way (the previous one stays on screen meanwhile). */
  isChanging: boolean;
  labels: PaginatorLabels;
  onPageChange: (page: number) => void;
}

interface PagedQuery {
  data: { page: number; pageSize: number; total: number; totalPages: number } | undefined;
  isPlaceholderData: boolean;
}

/**
 * A numbered list's page (from the URL) and its pager. After a page change the focus moves to the
 * list's heading, so keyboard and screen-reader users start reading the new rows from the top
 * instead of staying on a button at the bottom of a list that changed under them.
 */
export function useListPager(name: ListPageParam) {
  const { page, setPage } = usePageParam(name);
  // A callback ref kept in state: the hook's result is read during render, which a ref object
  // may not be (React compiler); the element is only used in the page-change handler.
  const [heading, bindHeading] = useState<HTMLHeadingElement | null>(null);
  return {
    page,
    setPage,
    bindHeading,
    view: ({ query, nav }: { query: PagedQuery; nav: string }): PagerView => ({
      // The page the API answered; while the next one loads, the page asked for (the pager moves at once).
      page: query.isPlaceholderData ? page : (query.data?.page ?? page),
      totalPages: query.data?.totalPages ?? 1,
      summary: pageSummary(query.data),
      isChanging: query.isPlaceholderData,
      labels: paginatorLabels(nav),
      onPageChange: (next) => {
        setPage(next);
        heading?.focus();
      },
    }),
  };
}
