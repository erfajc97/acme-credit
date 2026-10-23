import { ACCOUNT_STATUSES, type AccountStatus } from '@acme/contracts';
import { ACCOUNTS_LIST } from '@/app/helpers/listQuery';
import { searchEmptyState } from '@/app/helpers/listSearch';
import { usePagedList } from '@/app/hooks/usePagedList';
import { useListUrlState } from '@/app/hooks/useListUrlState';
import { t } from '@/app/i18n';
import { useAccountsQuery } from '@/app/tanstack-queries/adminQueries';
import { ALL_STATUSES, STATUS_FILTER_OPTIONS } from '../data';
import { toAccountRow } from '../helpers/accountRows';

const isStatus = (value: string): value is AccountStatus =>
  (ACCOUNT_STATUSES as readonly string[]).includes(value);

/**
 * The accounts list: the filters and the page live in the URL (W17), one numbered page at a time.
 * A new filter writes no page, so it starts at page 1.
 */
export function useAccountsList() {
  const { query, setQuery } = useListUrlState(ACCOUNTS_LIST);
  const list = usePagedList(useAccountsQuery(query), toAccountRow, {
    page: query.page ?? 1,
    setPage: (page: number) => setQuery({ ...query, page }),
  });
  const searched = searchEmptyState(query.q);
  const filtered = query.status
    ? { title: t('accounts.emptyTitle'), body: t('accounts.emptyBody'), canClear: true }
    : null;

  return {
    list,
    // A search says what found nothing; a status filter offers to clear it; neither = none yet.
    empty: (searched && { ...searched, canClear: true }) ??
      filtered ?? {
        title: t('accounts.emptyNoneTitle'),
        body: t('accounts.emptyNoneBody'),
        canClear: false,
      },
    statusValue: query.status ?? ALL_STATUSES,
    statusOptions: STATUS_FILTER_OPTIONS.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })),
    searchText: query.q ?? '',
    setStatus: (value: string) =>
      setQuery({ q: query.q, status: isStatus(value) ? value : undefined }),
    search: (text: string) => setQuery({ status: query.status, q: text || undefined }),
    isSearched: query.q !== undefined,
    clearSearch: () => setQuery({ status: query.status }),
    clearFilters: () => setQuery({}),
  };
}
