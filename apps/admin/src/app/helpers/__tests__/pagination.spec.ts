import { PAGE_NUMBER_MAX } from '@acme/contracts';
import { pageParamValue, pageRange, parsePageParam, withSearchParam } from '../pagination';

describe('parsePageParam (the page number in an address, as the API accepts it)', () => {
  it('reads page 2 and the last page the API accepts; page 1 is the canonical "no page"', () => {
    expect(parsePageParam('2')).toBe(2);
    expect(parsePageParam(String(PAGE_NUMBER_MAX))).toBe(PAGE_NUMBER_MAX);
    expect(parsePageParam('1')).toBeUndefined();
  });

  it('drops what the API would refuse: 0, past the ceiling, signs, decimals, blanks, absence', () => {
    for (const bad of [
      '0',
      String(PAGE_NUMBER_MAX + 1),
      '-2',
      '+2',
      '2.5',
      '1e1',
      ' 2',
      '',
      'two',
    ]) {
      expect(parsePageParam(bad), bad).toBeUndefined();
    }
    expect(parsePageParam(null)).toBeUndefined();
  });

  it('writes page 2 and up, and nothing for page 1 or no page', () => {
    expect(pageParamValue(2)).toBe('2');
    expect(pageParamValue(1)).toBeUndefined();
    expect(pageParamValue(undefined)).toBeUndefined();
  });
});

describe('pageRange ("Showing 11–20 of 47")', () => {
  it('numbers the rows of a middle page from the page and its size', () => {
    expect(pageRange({ page: 2, pageSize: 10, total: 47, itemCount: 10 })).toEqual({
      from: 11,
      to: 20,
      total: 47,
    });
  });

  it('ends at the last row of a short last page', () => {
    expect(pageRange({ page: 5, pageSize: 10, total: 47, itemCount: 7 })).toEqual({
      from: 41,
      to: 47,
      total: 47,
    });
  });

  it('is null for a page without rows (past the end)', () => {
    expect(pageRange({ page: 9, pageSize: 10, total: 47, itemCount: 0 })).toBeNull();
  });
});

describe('withSearchParam (one parameter changes, the others stay)', () => {
  it('sets, replaces and removes one parameter, keeping the rest in place', () => {
    expect(withSearchParam('?id=a1&journalPage=3', 'purchase', 'p-9')).toBe(
      '?id=a1&journalPage=3&purchase=p-9',
    );
    expect(withSearchParam('?id=a1&journalPage=3', 'journalPage', '4')).toBe(
      '?id=a1&journalPage=4',
    );
    expect(withSearchParam('?id=a1&journalPage=3', 'journalPage', undefined)).toBe('?id=a1');
    expect(withSearchParam('?purchase=p-9', 'purchase', undefined)).toBe('');
  });
});
