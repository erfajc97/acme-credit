/**
 * The address parameter that holds each history's page on the account page, next to `id`
 * (page 1 is never written).
 */
export const HISTORY_PAGE_PARAMS = {
  authorizations: 'purchasesPage',
  journal: 'journalPage',
  audit: 'auditPage',
} as const;

/** The address parameter that holds the search of each searchable history on the account page. */
export const HISTORY_SEARCH_PARAMS = {
  authorizations: 'purchasesQ',
  journal: 'journalQ',
} as const;
