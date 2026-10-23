import {
  ADMIN_SEARCH_MAX,
  adminAccountsQuerySchema,
  adminAuthorizationsQuerySchema,
  adminPayoutsQuerySchema,
  type AccountStatus,
  type AuthorizationStatus,
  type PayoutStatus,
} from '@acme/contracts';
import { z } from 'zod';
import { ROUTES } from '@/app/lib/endpoints';
import { pageParamValue, parsePageParam } from './pagination';

/**
 * One parser and one serialiser per list (W17). A parser keeps only the filters the API accepts,
 * field by field, so a bad value drops that filter and never the whole query; the serialiser
 * writes them in one canonical order and omits what is empty. The page number sits next to the
 * filters (`page`, never written for page 1), so a shared link, a reload, Back and the way back
 * open the same page; a filter change writes no page, so it starts at page 1. An old `cursor`
 * parameter is dropped like any unknown one.
 */
export interface ListDefinition<Q> {
  /** Names the list's slot in the session memory. */
  name: string;
  /** The list's own address. */
  path: string;
  parse: (search: string) => Q;
  serialize: (query: Q) => string;
}

function field<T>(schema: z.ZodType<T>, raw: string | null): T | undefined {
  if (raw === null) return undefined;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function toSearch(entries: [string, string | undefined][]): string {
  const params = new URLSearchParams();
  for (const [name, value] of entries) if (value) params.set(name, value);
  const text = params.toString();
  return text ? `?${text}` : '';
}

const accountsShape = adminAccountsQuerySchema.shape;

/**
 * Every admin list accepts `q`, trimmed, 1–ADMIN_SEARCH_MAX characters (the API's list-search
 * contract, G12): the parser and the search box read the contract's own cap.
 */
export const LIST_SEARCH_MAX = ADMIN_SEARCH_MAX;
// An empty or blank search box is "no filter", not a filter on "".
const searchText = z.string().trim().min(1).max(LIST_SEARCH_MAX);

export interface AccountsListQuery {
  status?: AccountStatus | undefined;
  q?: string | undefined;
  page?: number | undefined;
}

export function parseAccountsQuery(search: string): AccountsListQuery {
  const params = new URLSearchParams(search);
  return {
    status: field(accountsShape.status.unwrap(), params.get('status')),
    q: field(searchText, params.get('q')),
    page: parsePageParam(params.get('page')),
  };
}

export function serializeAccountsQuery(query: AccountsListQuery): string {
  return toSearch([
    ['status', query.status],
    ['q', query.q],
    ['page', pageParamValue(query.page)],
  ]);
}

export const ACCOUNTS_LIST: ListDefinition<AccountsListQuery> = {
  name: 'accounts',
  path: ROUTES.accounts,
  parse: parseAccountsQuery,
  serialize: serializeAccountsQuery,
};

/**
 * The audit log's entity filter, as the API's AuditLogQueryDto validates it (trimmed, 1–64
 * characters). The contract package does not export this cap yet (see the builder report).
 */
export const AUDIT_ENTITY_ID_MAX = 64;
const entityIdText = z.string().trim().min(1).max(AUDIT_ENTITY_ID_MAX);

export interface AuditListQuery {
  entityId?: string | undefined;
  q?: string | undefined;
  page?: number | undefined;
}

export function parseAuditQuery(search: string): AuditListQuery {
  const params = new URLSearchParams(search);
  return {
    entityId: field(entityIdText, params.get('entityId')),
    q: field(searchText, params.get('q')),
    page: parsePageParam(params.get('page')),
  };
}

export function serializeAuditQuery(query: AuditListQuery): string {
  return toSearch([
    ['entityId', query.entityId],
    ['q', query.q],
    ['page', pageParamValue(query.page)],
  ]);
}

export const AUDIT_LIST: ListDefinition<AuditListQuery> = {
  name: 'auditLog',
  path: ROUTES.auditLog,
  parse: parseAuditQuery,
  serialize: serializeAuditQuery,
};

const purchasesShape = adminAuthorizationsQuerySchema.shape;

export interface PurchasesListQuery {
  status?: AuthorizationStatus | undefined;
  q?: string | undefined;
  page?: number | undefined;
}

/** The purchases list: the status filter, as the API's admin query accepts it, the search and the page. */
export function parsePurchasesQuery(search: string): PurchasesListQuery {
  const params = new URLSearchParams(search);
  return {
    status: field(purchasesShape.status.unwrap(), params.get('status')),
    q: field(searchText, params.get('q')),
    page: parsePageParam(params.get('page')),
  };
}

export function serializePurchasesQuery(query: PurchasesListQuery): string {
  return toSearch([
    ['status', query.status],
    ['q', query.q],
    ['page', pageParamValue(query.page)],
  ]);
}

export const PURCHASES_LIST: ListDefinition<PurchasesListQuery> = {
  name: 'purchases',
  path: ROUTES.purchases,
  parse: parsePurchasesQuery,
  serialize: serializePurchasesQuery,
};

const payoutsShape = adminPayoutsQuerySchema.shape;

export interface PayoutsListQuery {
  status?: PayoutStatus | undefined;
  q?: string | undefined;
  page?: number | undefined;
}

/** The payouts list: the status filter, as the API's admin query accepts it, the search and the page. */
export function parsePayoutsQuery(search: string): PayoutsListQuery {
  const params = new URLSearchParams(search);
  return {
    status: field(payoutsShape.status.unwrap(), params.get('status')),
    q: field(searchText, params.get('q')),
    page: parsePageParam(params.get('page')),
  };
}

export function serializePayoutsQuery(query: PayoutsListQuery): string {
  return toSearch([
    ['status', query.status],
    ['q', query.q],
    ['page', pageParamValue(query.page)],
  ]);
}

export const PAYOUTS_LIST: ListDefinition<PayoutsListQuery> = {
  name: 'payouts',
  path: ROUTES.payouts,
  parse: parsePayoutsQuery,
  serialize: serializePayoutsQuery,
};

export interface LedgerListQuery {
  q?: string | undefined;
  page?: number | undefined;
}

/** The global ledger: its search and its page. */
export function parseLedgerQuery(search: string): LedgerListQuery {
  const params = new URLSearchParams(search);
  return { q: field(searchText, params.get('q')), page: parsePageParam(params.get('page')) };
}

export function serializeLedgerQuery(query: LedgerListQuery): string {
  return toSearch([
    ['q', query.q],
    ['page', pageParamValue(query.page)],
  ]);
}

/**
 * A search as a list's `q` (the box's text, or a history's `?journalQ=` on the account page):
 * trimmed, and "no filter" when blank or too long.
 */
export function parseSearchParam(raw: string | null): string | undefined {
  return field(searchText, raw);
}

export const LEDGER_LIST: ListDefinition<LedgerListQuery> = {
  name: 'ledger',
  path: ROUTES.ledger,
  parse: parseLedgerQuery,
  serialize: serializeLedgerQuery,
};
