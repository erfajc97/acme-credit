import { getActiveLocale } from '@/app/i18n';
import { localizePath } from '@/app/i18n/routing';

const segment = (id: string) => encodeURIComponent(id);

/** Every core API path the console calls, relative to `/v1` (docs/plan.md §3). */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  admin: {
    dashboard: '/admin/dashboard',
    accounts: '/admin/accounts',
    account: (accountId: string) => `/admin/accounts/${segment(accountId)}`,
    accountLedger: (accountId: string) => `/admin/accounts/${segment(accountId)}/ledger`,
    accountAuthorizations: (accountId: string) =>
      `/admin/accounts/${segment(accountId)}/authorizations`,
    authorizations: '/admin/authorizations',
    ledger: '/admin/ledger',
    auditLog: '/admin/audit-log',
    freeze: (accountId: string) => `/admin/accounts/${segment(accountId)}/freeze`,
    unfreeze: (accountId: string) => `/admin/accounts/${segment(accountId)}/unfreeze`,
    close: (accountId: string) => `/admin/accounts/${segment(accountId)}/close`,
    payouts: '/admin/payouts',
    releaseHold: (authorizationId: string) =>
      `/admin/authorizations/${segment(authorizationId)}/release`,
  },
} as const;

/**
 * The console's own routes (src/pages), without the locale prefix: links go through `localHref()`
 * / `localizePath()` so English pages stay under /en.
 */
export const ROUTES = {
  signIn: '/signin',
  dashboard: '/dashboard',
  accounts: '/accounts',
  accountView: '/accounts/view',
  purchases: '/purchases',
  payouts: '/payouts',
  ledger: '/ledger',
  auditLog: '/audit-log',
} as const;

/** A route of the console in the page's locale: `/ledger` → `/en/ledger` on English pages. */
export function localHref(path: string): string {
  return localizePath(path, getActiveLocale());
}

/** The detail page of one account (a query parameter keeps the build static), in the page's locale. */
export function accountHref(accountId: string): string {
  return localHref(`${ROUTES.accountView}?id=${encodeURIComponent(accountId)}`);
}

/** Where a lost session goes (the session gate and the 401 handler). */
export const SIGN_IN_PATH = ROUTES.signIn;
/** Where a signed-in admin lands. */
export const APP_HOME_PATH = ROUTES.dashboard;
