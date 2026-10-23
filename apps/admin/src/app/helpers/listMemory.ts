import { localizePath, splitLocalePath } from '@/app/i18n/routing';
import { ACCOUNTS_LIST, AUDIT_LIST, PURCHASES_LIST, type ListDefinition } from './listQuery';

const STORAGE_PREFIX = 'acme.admin.list.';

/** Lists whose way back can be restored from a static link (`data-list-back="<name>"`). */
const LISTS: Record<string, ListDefinition<unknown>> = {
  [ACCOUNTS_LIST.name]: ACCOUNTS_LIST as ListDefinition<unknown>,
  [AUDIT_LIST.name]: AUDIT_LIST as ListDefinition<unknown>,
  [PURCHASES_LIST.name]: PURCHASES_LIST as ListDefinition<unknown>,
};

function canonical<Q>(list: ListDefinition<Q>, search: string): string {
  return list.serialize(list.parse(search));
}

/**
 * Remembers the list's query for this tab (W17), passed through the list's own parser. It only
 * records while the address IS the list (in either locale): a list that mounts during Back →
 * Forward from another page must not overwrite the memory with a stale query.
 */
export function rememberListQuery<Q>(
  list: ListDefinition<Q>,
  location: { pathname: string; search: string },
): void {
  if (splitLocalePath(location.pathname).path !== list.path) return;
  try {
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}${list.name}`,
      canonical(list, location.search),
    );
  } catch {
    // Storage blocked (private mode, policy): the way back is the plain list, which still works.
  }
}

/**
 * The one way back to a list (back links, not-found actions, redirects): its remembered query,
 * re-parsed so only valid filters reach a link, or the plain list when nothing is remembered. The
 * link stays in the locale of the page the admin is on.
 */
export function listHref<Q>(list: ListDefinition<Q>): string {
  let stored: string | null = null;
  try {
    stored = window.sessionStorage.getItem(`${STORAGE_PREFIX}${list.name}`);
  } catch {
    // Storage blocked: fall back to the plain list.
  }
  const { locale } = splitLocalePath(window.location.pathname);
  return `${localizePath(list.path, locale)}${stored ? canonical(list, stored) : ''}`;
}

/**
 * Server-rendered back links stay the plain list (they work without JavaScript); the client only
 * swaps their `href` for the remembered one.
 */
export function applyListBackLinks(root: ParentNode): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-list-back]')) {
    const list = LISTS[link.dataset.listBack ?? ''];
    if (list) link.href = listHref(list);
  }
}
