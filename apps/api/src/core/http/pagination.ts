import { totalPagesOf, type PageQuery } from '@acme/contracts';

/** The validated `?page=&pageSize=` of every list (`pageQuerySchema`). */
export type PageInput = PageQuery;

/** The shape of every list response (`pageSchema` in the contract). */
export interface Page<Item> {
  items: Item[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageWindow {
  skip: number;
  take: number;
}

/** Page N of size S is OFFSET (N - 1) * S, LIMIT S. */
export function pageWindow({ page, pageSize }: PageInput): PageWindow {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * One list page: the window and the total are read in parallel (two independent statements, so
 * never inside a transaction: AN5). A page past the end has no items and still the real total.
 */
export async function paginate<Row, Item>(input: {
  query: PageInput;
  count: () => Promise<number>;
  read: (window: PageWindow) => Promise<Row[]>;
  map: (row: Row) => Item;
}): Promise<Page<Item>> {
  const { page, pageSize } = input.query;
  const [total, rows] = await Promise.all([input.count(), input.read(pageWindow(input.query))]);
  return {
    items: rows.map(input.map),
    page,
    pageSize,
    total,
    totalPages: totalPagesOf({ total, pageSize }),
  };
}
