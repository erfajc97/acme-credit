import { t } from '@/app/i18n';

export interface SearchEmptyState {
  title: string;
  body: string;
}

/**
 * The empty state of a searched list: "No results for «q»" and what to try, or null when the list
 * is not searched (each list then says why it is empty in its own words).
 */
export function searchEmptyState(q: string | undefined): SearchEmptyState | null {
  if (!q) return null;
  return { title: t('search.noResultsTitle', { q }), body: t('search.noResultsBody') };
}
