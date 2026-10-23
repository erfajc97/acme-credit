import { pageQuerySchema } from '@acme/contracts';

/*
 * Numbered pages (`?page=N&pageSize=10`, packages/contracts). The page number in an address goes
 * through the contract's own field (G12: the same digits-only rule and ceiling as the API), and
 * page 1 is never written, so the first page of a list has one canonical link.
 */

const pageNumber = pageQuerySchema.shape.page.unwrap();

/** A page number from the address: 2 and up; page 1, junk or absence are "no page" (undefined). */
export function parsePageParam(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = pageNumber.safeParse(raw);
  return parsed.success && parsed.data > 1 ? parsed.data : undefined;
}

/** What the address carries for a page: nothing for the first one. */
export function pageParamValue(page: number | undefined): string | undefined {
  return page !== undefined && page > 1 ? String(page) : undefined;
}

export interface PageRange {
  from: number;
  to: number;
  total: number;
}

/**
 * The rows a page shows, 1-based ("Showing 11–20 of 47"), from the page the API answered; null
 * when the page has no rows (an old link past the end of a list that shrank).
 */
export function pageRange({
  page,
  pageSize,
  total,
  itemCount,
}: {
  page: number;
  pageSize: number;
  total: number;
  itemCount: number;
}): PageRange | null {
  if (itemCount === 0) return null;
  const from = (page - 1) * pageSize + 1;
  return { from, to: from + itemCount - 1, total };
}

/** The query string with one parameter set (or removed when `value` is undefined), the rest kept. */
export function withSearchParam(search: string, name: string, value: string | undefined): string {
  const params = new URLSearchParams(search);
  if (value === undefined) params.delete(name);
  else params.set(name, value);
  const text = params.toString();
  return text ? `?${text}` : '';
}
