import { useMemo } from 'react';
import { toAuditRow } from '@/app/helpers/audit';
import { toJournalEntryRow } from '@/app/helpers/journal';
import { parseSearchParam } from '@/app/helpers/listQuery';
import { searchEmptyState } from '@/app/helpers/listSearch';
import { pushSearch } from '@/app/helpers/navigation';
import { pageParamValue, parsePageParam, withSearchParam } from '@/app/helpers/pagination';
import { usePagedList } from '@/app/hooks/usePagedList';
import { useUrlSearch } from '@/app/hooks/useListUrlState';
import {
  useAccountAuditQuery,
  useAccountAuthorizationsQuery,
  useAccountJournalQuery,
} from '@/app/tanstack-queries/adminQueries';
import { HISTORY_PAGE_PARAMS, HISTORY_SEARCH_PARAMS } from '../data';
import { toAuthorizationRow } from '../helpers/authorizationRows';

type History = keyof typeof HISTORY_PAGE_PARAMS;
type SearchableHistory = keyof typeof HISTORY_SEARCH_PARAMS;

/** Each history's page and search from the address (`?id=…&journalPage=3&journalQ=…`). */
function historyStateOf(search: string) {
  const params = new URLSearchParams(search);
  const page = (history: History) => parsePageParam(params.get(HISTORY_PAGE_PARAMS[history]));
  const q = (history: SearchableHistory) =>
    parseSearchParam(params.get(HISTORY_SEARCH_PARAMS[history]));
  return {
    authorizations: { page: page('authorizations'), q: q('authorizations') },
    journal: { page: page('journal'), q: q('journal') },
    audit: { page: page('audit') },
  };
}

/**
 * The account's three histories, one numbered page each, with their own loading, empty and error
 * states; purchases and journal entries can be searched. Each page and search lives in the address
 * next to the account id (W17), so Back walks them and a shared link opens them; a new search
 * drops that history's page (back to 1). Called with the id from the address, next to the account
 * read, so the four requests leave together.
 */
export function useAccountHistory(accountId: string | null) {
  const search = useUrlSearch();
  const state = useMemo(() => historyStateOf(search), [search]);
  const pager = (history: History) => ({
    page: state[history].page ?? 1,
    setPage: (page: number) =>
      pushSearch(
        withSearchParam(window.location.search, HISTORY_PAGE_PARAMS[history], pageParamValue(page)),
      ),
  });
  const searcher = (history: SearchableHistory) => {
    const q = state[history].q;
    const setSearch = (text: string) => {
      const withoutPage = withSearchParam(
        window.location.search,
        HISTORY_PAGE_PARAMS[history],
        undefined,
      );
      pushSearch(withSearchParam(withoutPage, HISTORY_SEARCH_PARAMS[history], text || undefined));
    };
    return {
      text: q ?? '',
      search: setSearch,
      clear: () => setSearch(''),
      empty: searchEmptyState(q),
    };
  };
  const authorizations = useAccountAuthorizationsQuery(accountId, state.authorizations);
  return {
    // The purchase sheet reads the page's own rows: a placeholder page is not the address's yet.
    authorizationItems: authorizations.isPlaceholderData ? undefined : authorizations.data?.items,
    authorizations: usePagedList(authorizations, toAuthorizationRow, pager('authorizations')),
    authorizationsSearch: searcher('authorizations'),
    journal: usePagedList(
      useAccountJournalQuery(accountId, state.journal),
      toJournalEntryRow,
      pager('journal'),
    ),
    journalSearch: searcher('journal'),
    audit: usePagedList(
      useAccountAuditQuery(accountId, state.audit.page),
      toAuditRow,
      pager('audit'),
    ),
  };
}

export type AccountHistoryView = ReturnType<typeof useAccountHistory>;
export type HistorySearchView = AccountHistoryView['journalSearch'];
