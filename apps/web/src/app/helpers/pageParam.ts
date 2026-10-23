import { PAGE_SIZE_MAX, pageQuerySchema, totalPagesOf } from '@acme/contracts';
import { ORDER_PARAM } from './orderParam';

/**
 * Each list on a screen keeps its page in its own query parameter (W17): the activity page shows
 * orders and movements side by side, and paging one must not move the other.
 */
export const LIST_PAGE_PARAMS = {
  orders: 'ordersPage',
  movements: 'movementsPage',
  store: 'page',
} as const;

export type ListPageParam = (typeof LIST_PAGE_PARAMS)[keyof typeof LIST_PAGE_PARAMS];

/** The contract's own page rule (digits only, 1..PAGE_NUMBER_MAX), so the URL and the API agree. */
const pageNumber = pageQuerySchema.shape.page;

/** The one parser of a list's page: a valid page number, or 1 when absent or malformed. */
export function readPageParam(search: string, name: ListPageParam): number {
  const parsed = pageNumber.safeParse(new URLSearchParams(search).get(name) ?? undefined);
  return parsed.success ? parsed.data : 1;
}

/** The address with a list on `page`, as a path for the history API; page 1 is the plain list. */
export function pageUrl({
  href,
  name,
  page,
}: {
  href: string;
  name: ListPageParam;
  page: number;
}): string {
  const url = new URL(href);
  if (page === 1) url.searchParams.delete(name);
  else url.searchParams.set(name, String(page));
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The rows a page shows, 1-based ("Showing 11–20 of 47"); null when it shows none. */
export function pageRange({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}): { from: number; to: number } | null {
  const from = (page - 1) * pageSize + 1;
  if (from > total) return null;
  return { from, to: Math.min(page * pageSize, total) };
}

/**
 * One page of a list the client already holds (the store catalog), in the API's page shape. A page
 * past the end shows the last one: a link kept from a wider filter still lands on products.
 */
export function paginate<T>(items: readonly T[], requested: number) {
  const pageSize = PAGE_SIZE_MAX;
  const total = items.length;
  const totalPages = totalPagesOf({ total, pageSize });
  const page = Math.min(requested, totalPages);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

/** What is left without the in-page state (the open order, the list pages): "which page". */
function withoutListState(href: string): string {
  const url = new URL(href);
  for (const name of [ORDER_PARAM, ...Object.values(LIST_PAGE_PARAMS)])
    url.searchParams.delete(name);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * A history move that stays on the same screen: only a sheet opens or closes, or a list changes
 * page. Such moves are hidden from Astro's ClientRouter, which would otherwise refetch and swap the
 * whole page.
 */
export function isInPageChange(from: string, to: string): boolean {
  return from !== to && withoutListState(from) === withoutListState(to);
}
