import { DEFAULT_LOCALE, setActiveLocale, t } from '@/app/i18n';
import { pageSummary, paginatorLabels } from '../pagination';

beforeEach(() => setActiveLocale('en-US'));
afterEach(() => setActiveLocale(DEFAULT_LOCALE));

describe('pageSummary', () => {
  it('counts the rows of the page in the page language', () => {
    expect(pageSummary({ page: 2, pageSize: 10, total: 47 })).toBe('Showing 11–20 of 47');
    setActiveLocale('es-MX');
    expect(pageSummary({ page: 5, pageSize: 10, total: 1047 })).toBe('Mostrando 41–50 de 1,047');
  });

  it('is null before the first page arrives, for an empty list and past the last page', () => {
    expect(pageSummary(undefined)).toBeNull();
    expect(pageSummary({ page: 1, pageSize: 10, total: 0 })).toBeNull();
    expect(pageSummary({ page: 6, pageSize: 10, total: 50 })).toBeNull();
  });
});

describe('paginatorLabels', () => {
  it("names the list's landmark and words every control through i18n", () => {
    const labels = paginatorLabels(t('activity.orders.pagesLabel'));
    expect(labels.nav).toBe('Order pages');
    expect(labels.previous).toBe('Previous');
    expect(labels.next).toBe('Next');
    expect(labels.page(4)).toBe('Page 4');
    expect(labels.status(4, 20)).toBe('Page 4 of 20');
  });
});
