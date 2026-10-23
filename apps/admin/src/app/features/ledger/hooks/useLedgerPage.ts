import { useMemo } from 'react';
import { toJournalEntryRow, trialBalanceView } from '@/app/helpers/journal';
import { LEDGER_LIST } from '@/app/helpers/listQuery';
import { searchEmptyState } from '@/app/helpers/listSearch';
import { t } from '@/app/i18n';
import { useListUrlState } from '@/app/hooks/useListUrlState';
import { usePagedList } from '@/app/hooks/usePagedList';
import { useDashboardQuery, useJournalQuery } from '@/app/tanstack-queries/adminQueries';

/**
 * The global ledger, one numbered page at a time, searchable (the search and the page in the URL),
 * under the trial balance.
 */
export function useLedgerPage() {
  const { query, setQuery } = useListUrlState(LEDGER_LIST);
  const entries = usePagedList(useJournalQuery(query), toJournalEntryRow, {
    page: query.page ?? 1,
    setPage: (page: number) => setQuery({ ...query, page }),
  });
  const dashboard = useDashboardQuery();
  const trialBalance = useMemo(
    () => (dashboard.data ? trialBalanceView(dashboard.data.ledgerTrialBalanceCents) : null),
    [dashboard.data],
  );
  return {
    entries,
    trialBalance,
    isTrialBalanceUnavailable: dashboard.isError,
    searchText: query.q ?? '',
    search: (text: string) => setQuery({ q: text || undefined }),
    clearSearch: () => setQuery({}),
    empty: searchEmptyState(query.q) ?? {
      title: t('ledger.emptyTitle'),
      body: t('ledger.emptyBody'),
    },
    isSearched: query.q !== undefined,
  };
}
