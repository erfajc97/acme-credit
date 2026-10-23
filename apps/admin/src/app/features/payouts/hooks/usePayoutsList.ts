import { PAYOUT_STATUSES, type PayoutStatus } from '@acme/contracts';
import { PAYOUTS_LIST } from '@/app/helpers/listQuery';
import { searchEmptyState } from '@/app/helpers/listSearch';
import { toPayoutRow } from '@/app/helpers/payouts';
import { usePagedList } from '@/app/hooks/usePagedList';
import { useListUrlState } from '@/app/hooks/useListUrlState';
import { t } from '@/app/i18n';
import { usePayoutsQuery } from '@/app/tanstack-queries/adminQueries';
import { ALL_STATUSES, STATUS_FILTER_OPTIONS } from '../data';

const isStatus = (value: string): value is PayoutStatus =>
  (PAYOUT_STATUSES as readonly string[]).includes(value);

/**
 * Money going back to customers: the status filter and the page live in the URL (W17), one
 * numbered page at a time; a new filter writes no page, so it starts at page 1.
 */
export function usePayoutsList() {
  const { query, setQuery } = useListUrlState(PAYOUTS_LIST);
  const list = usePagedList(usePayoutsQuery(query), toPayoutRow, {
    page: query.page ?? 1,
    setPage: (page: number) => setQuery({ ...query, page }),
  });
  const isFiltered = query.status !== undefined;
  const searched = searchEmptyState(query.q);
  return {
    list,
    // Filtered, the empty state offers every payout again; unfiltered, it says what will appear.
    empty: searched
      ? { ...searched, canShowAll: true }
      : isFiltered
        ? {
            title: t('payouts.emptyFilteredTitle'),
            body: t('payouts.emptyFilteredBody'),
            canShowAll: true,
          }
        : { title: t('payouts.emptyTitle'), body: t('payouts.emptyBody'), canShowAll: false },
    statusValue: query.status ?? ALL_STATUSES,
    statusOptions: STATUS_FILTER_OPTIONS.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })),
    setStatus: (value: string) =>
      setQuery({ q: query.q, status: isStatus(value) ? value : undefined }),
    searchText: query.q ?? '',
    search: (text: string) => setQuery({ status: query.status, q: text || undefined }),
    isSearched: query.q !== undefined,
    clearSearch: () => setQuery({ status: query.status }),
    showAll: () => setQuery({}),
  };
}
