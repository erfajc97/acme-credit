const segment = (id: string) => encodeURIComponent(id);

/** Every path the apps call, relative to `/v1` of its service (docs/plan.md §3). */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  accounts: {
    open: '/accounts',
    mine: '/accounts/me',
    deposits: (accountId: string) => `/accounts/${segment(accountId)}/deposits`,
    repayments: (accountId: string) => `/accounts/${segment(accountId)}/repayments`,
    activity: (accountId: string) => `/accounts/${segment(accountId)}/activity`,
    authorizations: (accountId: string) => `/accounts/${segment(accountId)}/authorizations`,
    authorization: (accountId: string, authorizationId: string) =>
      `/accounts/${segment(accountId)}/authorizations/${segment(authorizationId)}`,
    freeze: (accountId: string) => `/accounts/${segment(accountId)}/freeze`,
    unfreeze: (accountId: string) => `/accounts/${segment(accountId)}/unfreeze`,
    close: (accountId: string) => `/accounts/${segment(accountId)}/close`,
  },
  network: {
    checkout: '/checkout',
    voidPurchase: (authorizationId: string) => `/purchases/${segment(authorizationId)}/void`,
  },
} as const;

/**
 * The web app's own routes (src/pages), without the locale prefix: links go through
 * `localHref()` / `localizePath()` so English pages stay under /en.
 */
export const ROUTES = {
  home: '/',
  signIn: '/signin',
  signUp: '/signup',
  app: '/app',
  card: '/app/card',
  store: '/app/store',
  checkout: '/app/checkout',
  activity: '/app/activity',
  profile: '/app/profile',
} as const;

/** Where a lost session goes (the session gate and the 401 handler). */
export const SIGN_IN_PATH = ROUTES.signIn;
/** Where a signed-in customer lands. */
export const APP_HOME_PATH = ROUTES.app;
