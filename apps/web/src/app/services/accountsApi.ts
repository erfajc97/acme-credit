import {
  accountSchema,
  activitySchema,
  authorizationDetailSchema,
  authorizationSchema,
  depositSchema,
  PAGE_SIZE_MAX,
  pageSchema,
  repaymentSchema,
  type Account,
  type AuthorizationDetail,
} from '@acme/contracts';
import { ApiError, apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';

/** Reads of the customer's account shared by several features (the shared queries' fetchers). */

/** The customer's account, or null when none was opened yet (the API answers 404). */
export async function fetchMyAccount(): Promise<Account | null> {
  try {
    return await apiRequest({ path: ENDPOINTS.accounts.mine, schema: accountSchema });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

const depositPageSchema = pageSchema(depositSchema);
const repaymentPageSchema = pageSchema(repaymentSchema);
const activityPageSchema = pageSchema(activitySchema);
const authorizationPageSchema = pageSchema(authorizationSchema);

export type DepositPage = ReturnType<typeof depositPageSchema.parse>;
export type RepaymentPage = ReturnType<typeof repaymentPageSchema.parse>;
export type ActivityPage = ReturnType<typeof activityPageSchema.parse>;
export type AuthorizationPage = ReturnType<typeof authorizationPageSchema.parse>;

/** Newest first; the first page is enough to follow the latest transfer. */
export function fetchDeposits(accountId: string): Promise<DepositPage> {
  return apiRequest({ path: ENDPOINTS.accounts.deposits(accountId), schema: depositPageSchema });
}

export function fetchRepayments(accountId: string): Promise<RepaymentPage> {
  return apiRequest({
    path: ENDPOINTS.accounts.repayments(accountId),
    schema: repaymentPageSchema,
  });
}

/** Which numbered page of an account's list (1-based); every list shows the contract's maximum. */
export interface AccountPageQuery {
  accountId: string;
  page: number;
}

/** The account's ledger movements, newest first, one numbered page at a time. */
export function fetchActivity({ accountId, page }: AccountPageQuery): Promise<ActivityPage> {
  return apiRequest({
    path: ENDPOINTS.accounts.activity(accountId),
    schema: activityPageSchema,
    query: { page, pageSize: PAGE_SIZE_MAX },
  });
}

/** The account's orders, newest first, one numbered page at a time. */
export function fetchAuthorizations({
  accountId,
  page,
}: AccountPageQuery): Promise<AuthorizationPage> {
  return apiRequest({
    path: ENDPOINTS.accounts.authorizations(accountId),
    schema: authorizationPageSchema,
    query: { page, pageSize: PAGE_SIZE_MAX },
  });
}

/** One order with its lines and timeline; a foreign or unknown id is a 404 (common.not_found). */
export function fetchAuthorizationDetail(
  accountId: string,
  authorizationId: string,
): Promise<AuthorizationDetail> {
  return apiRequest({
    path: ENDPOINTS.accounts.authorization(accountId, authorizationId),
    schema: authorizationDetailSchema,
  });
}
