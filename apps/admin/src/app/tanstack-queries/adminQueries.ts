import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import type { AuthorizationStatus, PayoutStatus } from '@acme/contracts';
import type {
  AccountsListQuery,
  PayoutsListQuery,
  PurchasesListQuery,
} from '@/app/helpers/listQuery';
import {
  fetchAccount,
  fetchAccountAuthorizations,
  fetchAccounts,
  fetchAuditLog,
  fetchDashboard,
  fetchJournal,
  fetchPayouts,
  fetchPayoutSample,
  fetchPurchases,
  fetchPurchaseSample,
  type PageFilter,
} from '@/app/services/adminApi';
import { useAuthStore } from '@/app/store/authStore';

/**
 * The back office's shared queries (W4). Every key starts with an exported `*_KEY`, so a
 * mutation invalidates every variant of a list (all filters, all pages, all accounts) by its
 * prefix. Lists are numbered pages keyed by their filters AND their page (1 when the address has
 * none): coming back to a page (Back, the nav, the way back) shows it at once from the cache, and a
 * new page or filter keeps the previous rows on screen, marked as updating, instead of flashing
 * the skeleton (placeholderData). The `*Options` factories are shared by the hooks and the
 * nav-intent prefetch, so both read and write the same cache entry. Private: each hook waits for
 * the session.
 */
export const DASHBOARD_KEY = 'admin-dashboard';
export const ACCOUNTS_KEY = 'admin-accounts';
export const ACCOUNT_KEY = 'admin-account';
export const AUTHORIZATIONS_KEY = 'admin-authorizations';
export const PURCHASES_KEY = 'admin-purchases';
export const JOURNAL_KEY = 'admin-journal';
export const AUDIT_LOG_KEY = 'admin-audit-log';
export const PAYOUTS_KEY = 'admin-payouts';

function useSignedIn(): boolean {
  return useAuthStore((state) => state.status === 'authenticated');
}

/** The search a key names: `null` when the list is not searched. */
const searchOf = (q: string | undefined) => q ?? null;

/** The page a key names: the address omits page 1, the cache key never does. */
const pageOf = (page: number | undefined) => page ?? 1;

/**
 * Keeps the previous page on screen only while it belongs to the same owner (the whole ledger,
 * one account, one entity): another account's rows are never a placeholder.
 */
function previousPageOfSame<T>(owner: string | null) {
  return (previous: T | undefined, previousQuery: { queryKey: readonly unknown[] } | undefined) =>
    previousQuery?.queryKey[1] === owner ? previous : undefined;
}

export const dashboardQueryOptions = () =>
  queryOptions({ queryKey: [DASHBOARD_KEY], queryFn: fetchDashboard });

/** One page of the accounts list for its filters. */
export const accountsQueryOptions = (filters: AccountsListQuery) =>
  queryOptions({
    queryKey: [ACCOUNTS_KEY, filters.status ?? null, filters.q ?? null, pageOf(filters.page)],
    queryFn: () => fetchAccounts(filters),
    placeholderData: keepPreviousData,
  });

/** One page of the wallet's purchases for a status filter (`list`), apart from the dashboard's. */
export const purchasesQueryOptions = (filters: PurchasesListQuery) =>
  queryOptions({
    queryKey: [
      PURCHASES_KEY,
      'list',
      filters.status ?? null,
      searchOf(filters.q),
      pageOf(filters.page),
    ],
    queryFn: () => fetchPurchases(filters),
    placeholderData: keepPreviousData,
  });

/**
 * The dashboard's sample of the newest purchases (`null` = every status): page 1 only. Under
 * PURCHASES_KEY, so releasing a hold refreshes it with the lists.
 */
export const purchaseSampleQueryOptions = (status: AuthorizationStatus | null) =>
  queryOptions({
    queryKey: [PURCHASES_KEY, 'sample', status],
    queryFn: () => fetchPurchaseSample(status),
  });

/** One page of the payouts list for a status filter (`list`), apart from the dashboard's. */
export const payoutsQueryOptions = (filters: PayoutsListQuery) =>
  queryOptions({
    queryKey: [
      PAYOUTS_KEY,
      'list',
      filters.status ?? null,
      searchOf(filters.q),
      pageOf(filters.page),
    ],
    queryFn: () => fetchPayouts(filters),
    placeholderData: keepPreviousData,
  });

/** The dashboard's newest payouts in one status (pending, failed). */
export const payoutSampleQueryOptions = (status: PayoutStatus) =>
  queryOptions({
    queryKey: [PAYOUTS_KEY, 'sample', status],
    queryFn: () => fetchPayoutSample(status),
  });

/** One page of journal entries: the whole ledger (`accountId` null) or one account's. */
export const journalQueryOptions = (accountId: string | null, filter: PageFilter = {}) =>
  queryOptions({
    queryKey: [JOURNAL_KEY, accountId, searchOf(filter.q), pageOf(filter.page)],
    queryFn: () => fetchJournal(accountId, filter),
    placeholderData: previousPageOfSame(accountId),
  });

/** One page of the audit trail: everything (`entityId` null) or one entity's history. */
export const auditLogQueryOptions = (entityId: string | null, filter: PageFilter = {}) =>
  queryOptions({
    queryKey: [AUDIT_LOG_KEY, entityId, searchOf(filter.q), pageOf(filter.page)],
    queryFn: () => fetchAuditLog(entityId, filter),
    placeholderData: previousPageOfSame(entityId),
  });

export function useDashboardQuery() {
  return useQuery({ ...dashboardQueryOptions(), enabled: useSignedIn() });
}

export function useAccountsQuery(filters: AccountsListQuery) {
  return useQuery({ ...accountsQueryOptions(filters), enabled: useSignedIn() });
}

export function usePurchasesQuery(filters: PurchasesListQuery) {
  return useQuery({ ...purchasesQueryOptions(filters), enabled: useSignedIn() });
}

export function usePurchaseSampleQuery(status: AuthorizationStatus | null) {
  return useQuery({ ...purchaseSampleQueryOptions(status), enabled: useSignedIn() });
}

export function usePayoutsQuery(filters: PayoutsListQuery) {
  return useQuery({ ...payoutsQueryOptions(filters), enabled: useSignedIn() });
}

export function usePayoutSampleQuery(status: PayoutStatus) {
  return useQuery({ ...payoutSampleQueryOptions(status), enabled: useSignedIn() });
}

/** A disabled query never runs its queryFn: the empty id below only satisfies the types. */
const idOrEmpty = (id: string | null) => id ?? '';

export function useAccountQuery(accountId: string | null) {
  const signedIn = useSignedIn();
  const id = idOrEmpty(accountId);
  return useQuery({
    queryKey: [ACCOUNT_KEY, accountId],
    queryFn: () => fetchAccount(id),
    enabled: signedIn && accountId !== null,
  });
}

/** One page of the global ledger (/ledger) for its search. */
export function useJournalQuery(filter: PageFilter) {
  return useQuery({ ...journalQueryOptions(null, filter), enabled: useSignedIn() });
}

/** One page of the audit log, everything or one entity's, for its search. */
export function useAuditLogQuery(entityId: string | null, filter: PageFilter) {
  return useQuery({ ...auditLogQueryOptions(entityId, filter), enabled: useSignedIn() });
}

/*
 * One account's histories, one page each. They run in parallel with the account itself (no
 * waterfall): the id comes from the address, so none of them waits for the account to arrive.
 * Nothing is read without a valid id (null).
 */

export function useAccountAuthorizationsQuery(accountId: string | null, filter: PageFilter) {
  const signedIn = useSignedIn();
  const id = idOrEmpty(accountId);
  return useQuery({
    queryKey: [AUTHORIZATIONS_KEY, accountId, searchOf(filter.q), pageOf(filter.page)],
    queryFn: () => fetchAccountAuthorizations(id, filter),
    placeholderData: previousPageOfSame(accountId),
    enabled: signedIn && accountId !== null,
  });
}

export function useAccountJournalQuery(accountId: string | null, filter: PageFilter) {
  const signedIn = useSignedIn();
  return useQuery({
    ...journalQueryOptions(accountId, filter),
    enabled: signedIn && accountId !== null,
  });
}

export function useAccountAuditQuery(accountId: string | null, page: number | undefined) {
  const signedIn = useSignedIn();
  return useQuery({
    ...auditLogQueryOptions(accountId, { page }),
    enabled: signedIn && accountId !== null,
  });
}
