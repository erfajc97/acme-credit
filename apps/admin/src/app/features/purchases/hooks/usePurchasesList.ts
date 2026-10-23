import {
  AUTHORIZATION_STATUSES,
  type AdminAuthorization,
  type AuthorizationStatus,
} from '@acme/contracts';
import { PURCHASES_LIST } from '@/app/helpers/listQuery';
import { searchEmptyState } from '@/app/helpers/listSearch';
import { toPurchaseRow } from '@/app/helpers/orders';
import { usePagedList } from '@/app/hooks/usePagedList';
import { usePurchaseDetail } from '@/app/hooks/usePurchaseDetail';
import { useListUrlState } from '@/app/hooks/useListUrlState';
import { useReleaseHold } from '@/app/hooks/useReleaseHold';
import { t } from '@/app/i18n';
import { usePurchasesQuery } from '@/app/tanstack-queries/adminQueries';
import { ALL_STATUSES, STATUS_FILTER_OPTIONS } from '../data';

const customerOf = (item: AdminAuthorization) =>
  item.customer ? { name: item.customer.fullName, email: item.customer.email } : null;

const isStatus = (value: string): value is AuthorizationStatus =>
  (AUTHORIZATION_STATUSES as readonly string[]).includes(value);

/**
 * The wallet's purchases: the status filter and the page live in the URL (W17), one numbered page
 * at a time; a new filter writes no page, so it starts at page 1. A live hold can be released
 * from its row (confirmed in a dialog); a purchase opens its detail sheet (`?purchase=<id>`).
 */
export function usePurchasesList() {
  const { query, setQuery } = useListUrlState(PURCHASES_LIST);
  const purchases = usePurchasesQuery(query);
  const list = usePagedList(purchases, toPurchaseRow, {
    page: query.page ?? 1,
    setPage: (page: number) => setQuery({ ...query, page }),
  });
  const isFiltered = query.status !== undefined;
  const searched = searchEmptyState(query.q);

  return {
    list,
    release: useReleaseHold(),
    // The sheet reads the page's own rows: a placeholder page is not the address's page yet.
    detail: usePurchaseDetail(
      purchases.isPlaceholderData ? undefined : purchases.data?.items,
      customerOf,
    ),
    // Filtered, the empty state offers every purchase again; unfiltered, it says what will appear.
    empty: searched
      ? { ...searched, canShowAll: true }
      : isFiltered
        ? {
            title: t('purchases.emptyFilteredTitle'),
            body: t('purchases.emptyFilteredBody'),
            canShowAll: true,
          }
        : { title: t('purchases.emptyTitle'), body: t('purchases.emptyBody'), canShowAll: false },
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
