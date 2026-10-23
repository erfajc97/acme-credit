import { keepPreviousData, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { setActiveLocale, t } from '@/app/i18n';
import { ApiError } from '@/app/lib/apiClient';
import { queryClient } from '@/app/lib/queryClient';
import { usePagedList } from '../usePagedList';

beforeEach(() => setActiveLocale('en-US'));

interface Page {
  items: { id: string }[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const toRow = (item: { id: string }) => `row ${item.id}`;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** The API's answer for a page of a 23-row list (10 per page): unique ids per page (FT5). */
function pageOf(page: number, total = 23): Page {
  const first = (page - 1) * 10;
  const count = Math.max(0, Math.min(10, total - first));
  return {
    items: Array.from({ length: count }, (_, index) => ({ id: `${first + index + 1}` })),
    page,
    pageSize: 10,
    total,
    totalPages: Math.max(1, Math.ceil(total / 10)),
  };
}

/** A real query (never faked, FT22) keyed by the page the address asks for. */
function renderList(answer: (page: number) => Promise<Page>) {
  const setPage = vi.fn();
  const view = renderHook(
    ({ page }: { page: number }) =>
      usePagedList(
        useQuery({
          queryKey: ['test-paged', page],
          queryFn: () => answer(page),
          placeholderData: keepPreviousData,
        }),
        toRow,
        { page, setPage },
      ),
    { wrapper, initialProps: { page: 1 } },
  );
  return { ...view, setPage };
}

describe('usePagedList (one numbered page of a list)', () => {
  it('loads, then shows the page rows, the page count and "Showing 1–10 of 23"', async () => {
    const { result } = renderList(async (page) => pageOf(page));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    expect(result.current.rows[0]).toBe('row 1');
    expect(result.current).toMatchObject({
      isLoading: false,
      isError: false,
      isEmpty: false,
      isUpdating: false,
      page: 1,
      totalPages: 3,
    });
    expect(result.current.rangeMessage).toBe(
      t('common.pageRange', { from: '1', to: '10', total: '23' }),
    );
  });

  it('a new page keeps the previous rows, marked as updating, until it arrives (no skeleton flash)', async () => {
    let releaseSecond: (page: Page) => void = () => undefined;
    const { result, rerender } = renderList((page) =>
      page === 1
        ? Promise.resolve(pageOf(1))
        : new Promise<Page>((resolve) => (releaseSecond = resolve)),
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    rerender({ page: 3 });
    expect(result.current).toMatchObject({ isUpdating: true, isLoading: false, page: 3 });
    expect(result.current.rows[0]).toBe('row 1');
    act(() => releaseSecond(pageOf(3)));
    await waitFor(() => expect(result.current.rows).toEqual(['row 21', 'row 22', 'row 23']));
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.rangeMessage).toBe(
      t('common.pageRange', { from: '21', to: '23', total: '23' }),
    );
  });

  it('changes page through the address setter it was given', async () => {
    const { result, setPage } = renderList(async (page) => pageOf(page));
    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    act(() => result.current.setPage(2));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('an empty list (total 0) is the empty state, not an error', async () => {
    const { result } = renderList(async () => pageOf(1, 0));
    await waitFor(() => expect(result.current.isEmpty).toBe(true));
    expect(result.current).toMatchObject({ isError: false, isOutOfRange: false, totalPages: 1 });
  });

  it('one row is a list, not the empty state (the boundary next to zero)', async () => {
    const { result } = renderList(async () => pageOf(1, 1));
    await waitFor(() => expect(result.current.rows).toEqual(['row 1']));
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.rangeMessage).toBe(
      t('common.pageRange', { from: '1', to: '1', total: '1' }),
    );
  });

  it('a page past the end of a list that has rows says so (not "no rows at all")', async () => {
    const { result } = renderList(async () => pageOf(9));
    await waitFor(() => expect(result.current.isOutOfRange).toBe(true));
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.rangeMessage).toBe(t('common.pageOutOfRange', { totalPages: '3' }));
  });

  it('a failed read is the error state with a retry that reads again', async () => {
    let fail = true;
    const { result } = renderList(async (page) => {
      if (fail) throw new ApiError(429, 'common.rate_limited');
      return pageOf(page);
    });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    fail = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    expect(result.current.isError).toBe(false);
  });
});
