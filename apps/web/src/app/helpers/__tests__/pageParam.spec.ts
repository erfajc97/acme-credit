import { PAGE_NUMBER_MAX } from '@acme/contracts';
import {
  isInPageChange,
  LIST_PAGE_PARAMS,
  paginate,
  pageRange,
  pageUrl,
  readPageParam,
} from '@/app/helpers/pageParam';

const ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const { orders, movements } = LIST_PAGE_PARAMS;

describe('readPageParam (the one parser of a list page)', () => {
  it('reads the page of each list from its own parameter', () => {
    expect(readPageParam('?ordersPage=3&movementsPage=7', orders)).toBe(3);
    expect(readPageParam('?ordersPage=3&movementsPage=7', movements)).toBe(7);
  });

  it('is page 1 when absent, empty or malformed (a hand-edited link still opens the list)', () => {
    for (const search of [
      '',
      '?ordersPage=',
      '?ordersPage=0',
      '?ordersPage=-2',
      '?ordersPage=2.5',
      '?ordersPage=1e3',
      '?ordersPage=abc',
    ]) {
      expect(readPageParam(search, orders)).toBe(1);
    }
  });

  it("accepts the API's last page number and rejects the next one (same cap as the contract)", () => {
    expect(readPageParam(`?ordersPage=${PAGE_NUMBER_MAX}`, orders)).toBe(PAGE_NUMBER_MAX);
    expect(readPageParam(`?ordersPage=${PAGE_NUMBER_MAX + 1}`, orders)).toBe(1);
  });
});

describe('pageUrl', () => {
  it('sets the page of one list, keeping the other parameters and the hash', () => {
    expect(
      pageUrl({ href: `http://h/app/activity?movementsPage=2#top`, name: orders, page: 4 }),
    ).toBe('/app/activity?movementsPage=2&ordersPage=4#top');
  });

  it('drops the parameter on page 1, so the plain list keeps its plain address', () => {
    expect(pageUrl({ href: 'http://h/app/activity?ordersPage=4', name: orders, page: 1 })).toBe(
      '/app/activity',
    );
  });

  it('is read back by the one parser', () => {
    const url = pageUrl({ href: 'http://h/app/activity', name: movements, page: 9 });
    expect(readPageParam(new URL(url, 'http://h').search, movements)).toBe(9);
  });
});

describe('pageRange ("Showing 11–20 of 47")', () => {
  it('is the first and last row of a full page and of the shorter last page', () => {
    expect(pageRange({ page: 2, pageSize: 10, total: 47 })).toEqual({ from: 11, to: 20 });
    expect(pageRange({ page: 5, pageSize: 10, total: 47 })).toEqual({ from: 41, to: 47 });
    expect(pageRange({ page: 1, pageSize: 10, total: 10 })).toEqual({ from: 1, to: 10 });
  });

  it('is null for an empty list and for a page past the end (nothing to count)', () => {
    expect(pageRange({ page: 1, pageSize: 10, total: 0 })).toBeNull();
    expect(pageRange({ page: 6, pageSize: 10, total: 50 })).toBeNull();
    expect(pageRange({ page: 5, pageSize: 10, total: 41 })).toEqual({ from: 41, to: 41 });
  });
});

describe('isInPageChange (history moves the ClientRouter must not see)', () => {
  it('is true between the list and one of its orders, both ways', () => {
    expect(isInPageChange('http://h/app/activity', `http://h/app/activity?order=${ID}`)).toBe(true);
    expect(isInPageChange(`http://h/app/activity?order=${ID}`, 'http://h/app/activity')).toBe(true);
  });

  it('is true between two pages of a list (Back walks the pages without reloading)', () => {
    expect(isInPageChange('http://h/app/activity', 'http://h/app/activity?ordersPage=2')).toBe(
      true,
    );
    expect(
      isInPageChange(
        'http://h/app/activity?ordersPage=2',
        'http://h/app/activity?ordersPage=2&movementsPage=3',
      ),
    ).toBe(true);
  });

  it('is false for the same address (nothing to hide) and for any other change', () => {
    expect(isInPageChange('http://h/app/activity', 'http://h/app/activity')).toBe(false);
    expect(isInPageChange(`http://h/app/activity?order=${ID}`, 'http://h/app/store')).toBe(false);
    expect(isInPageChange('http://h/app/activity', 'http://h/en/app/activity')).toBe(false);
    expect(
      isInPageChange('http://h/app/activity?tab=a', `http://h/app/activity?tab=b&order=${ID}`),
    ).toBe(false);
  });
});

describe('paginate (a list the client holds: the store catalog)', () => {
  const twelve = Array.from({ length: 12 }, (_, index) => index + 1);

  it('cuts pages of 10: a full first page and the 2 left on the last', () => {
    expect(paginate(twelve, 1)).toEqual({
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      page: 1,
      pageSize: 10,
      total: 12,
      totalPages: 2,
    });
    expect(paginate(twelve, 2).items).toEqual([11, 12]);
  });

  it('keeps exactly 10 on one page (the last size without a second page) and opens page 2 at 11', () => {
    expect(paginate(twelve.slice(0, 10), 1).totalPages).toBe(1);
    expect(paginate(twelve.slice(0, 11), 1).totalPages).toBe(2);
  });

  it('shows the last page for a page past the end, and page 1 of nothing for an empty list', () => {
    expect(paginate(twelve, 9)).toMatchObject({ page: 2, items: [11, 12] });
    expect(paginate([], 3)).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  });
});
