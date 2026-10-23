import {
  adminAccountDetailSchema,
  adminAccountSchema,
  adminAuthorizationSchema,
  adminPayoutSchema,
  auditLogEntrySchema,
  authorizationSchema,
  dashboardSchema,
  journalEntrySchema,
  PAGE_SIZE_MAX,
  pageSchema,
  type AdminAccountDetail,
  type AuthorizationStatus,
  type Dashboard,
  type PayoutStatus,
} from '@acme/contracts';
import type {
  AccountsListQuery,
  PayoutsListQuery,
  PurchasesListQuery,
} from '@/app/helpers/listQuery';
import { ApiError, apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';

/** Reads of the back office shared by several screens (the shared queries' fetchers). */

const accountPageSchema = pageSchema(adminAccountSchema);
const journalPageSchema = pageSchema(journalEntrySchema);
const authorizationPageSchema = pageSchema(authorizationSchema);
const auditPageSchema = pageSchema(auditLogEntrySchema);
const purchasePageSchema = pageSchema(adminAuthorizationSchema);
const payoutPageSchema = pageSchema(adminPayoutSchema);

export type AccountPage = ReturnType<typeof accountPageSchema.parse>;
export type JournalPage = ReturnType<typeof journalPageSchema.parse>;
export type AuthorizationPage = ReturnType<typeof authorizationPageSchema.parse>;
export type AuditPage = ReturnType<typeof auditPageSchema.parse>;
export type PurchasePage = ReturnType<typeof purchasePageSchema.parse>;
export type PayoutPage = ReturnType<typeof payoutPageSchema.parse>;

/**
 * Every list shows numbered pages of 10 rows (owner decision, the API's largest page). One size
 * for phones and desktop, so the nav-intent prefetch warms the very cache entry the screen reads.
 */
export const LIST_PAGE_SIZE = PAGE_SIZE_MAX;
/**
 * The dashboard reads the newest rows of a few lists in one page each (the API's largest page) to
 * show what its figures endpoint does not count: the purchase trend, holds about to expire and
 * payouts waiting or failed. The screen says "latest N" whenever a list has more than that.
 */
export const DASHBOARD_SAMPLE_SIZE = PAGE_SIZE_MAX;

/** The page a list asks for: page 1 when the address carries none. */
const pageParams = (page: number | undefined) => ({ page: page ?? 1, pageSize: LIST_PAGE_SIZE });

/** One page of a list, narrowed by its search (`q`; absent = everything). */
export interface PageFilter {
  page?: number | undefined;
  q?: string | undefined;
}

export function fetchDashboard(): Promise<Dashboard> {
  return apiRequest({ path: ENDPOINTS.admin.dashboard, schema: dashboardSchema });
}

/** One page of accounts for the filters (and the page) of the list's address. */
export function fetchAccounts(filters: AccountsListQuery): Promise<AccountPage> {
  return apiRequest({
    path: ENDPOINTS.admin.accounts,
    schema: accountPageSchema,
    query: { status: filters.status, q: filters.q, ...pageParams(filters.page) },
  });
}

/** One account with its payouts, or null when it does not exist (the API answers 404). */
export async function fetchAccount(accountId: string): Promise<AdminAccountDetail | null> {
  try {
    return await apiRequest({
      path: ENDPOINTS.admin.account(accountId),
      schema: adminAccountDetailSchema,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function fetchAccountAuthorizations(
  accountId: string,
  { page, q }: PageFilter,
): Promise<AuthorizationPage> {
  return apiRequest({
    path: ENDPOINTS.admin.accountAuthorizations(accountId),
    schema: authorizationPageSchema,
    query: { q, ...pageParams(page) },
  });
}

/** Journal entries, newest first: the whole ledger, or one account's when `accountId` is set. */
export function fetchJournal(
  accountId: string | null,
  { page, q }: PageFilter,
): Promise<JournalPage> {
  return apiRequest({
    path: accountId ? ENDPOINTS.admin.accountLedger(accountId) : ENDPOINTS.admin.ledger,
    schema: journalPageSchema,
    query: { q, ...pageParams(page) },
  });
}

export function fetchAuditLog(
  entityId: string | null,
  { page, q }: PageFilter,
): Promise<AuditPage> {
  return apiRequest({
    path: ENDPOINTS.admin.auditLog,
    schema: auditPageSchema,
    query: { entityId: entityId ?? undefined, q, ...pageParams(page) },
  });
}

/** One page of the wallet's purchases (GET /admin/authorizations), newest first, with its customer. */
export function fetchPurchases(filters: PurchasesListQuery): Promise<PurchasePage> {
  return apiRequest({
    path: ENDPOINTS.admin.authorizations,
    schema: purchasePageSchema,
    query: { status: filters.status, q: filters.q, ...pageParams(filters.page) },
  });
}

/** The newest purchases of the wallet (one status, or all), for the dashboard's sample. */
export function fetchPurchaseSample(status: AuthorizationStatus | null): Promise<PurchasePage> {
  return apiRequest({
    path: ENDPOINTS.admin.authorizations,
    schema: purchasePageSchema,
    query: { status: status ?? undefined, page: 1, pageSize: DASHBOARD_SAMPLE_SIZE },
  });
}

/** One page of payouts (GET /admin/payouts), newest first, with the customer they go to. */
export function fetchPayouts(filters: PayoutsListQuery): Promise<PayoutPage> {
  return apiRequest({
    path: ENDPOINTS.admin.payouts,
    schema: payoutPageSchema,
    query: { status: filters.status, q: filters.q, ...pageParams(filters.page) },
  });
}

/** The newest payouts in one status, for the dashboard's counts and alerts. */
export function fetchPayoutSample(status: PayoutStatus): Promise<PayoutPage> {
  return apiRequest({
    path: ENDPOINTS.admin.payouts,
    schema: payoutPageSchema,
    query: { status, page: 1, pageSize: DASHBOARD_SAMPLE_SIZE },
  });
}
