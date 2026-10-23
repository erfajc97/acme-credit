import type { Authorization } from '@acme/contracts';
import { useMemo, type MouseEvent } from 'react';
import { pushSearch, replaceSearch } from '@/app/helpers/navigation';
import { withSearchParam } from '@/app/helpers/pagination';
import { toPurchaseDetail } from '@/app/helpers/purchaseDetail';
import { useUrlSearch } from './useListUrlState';

/** The address parameter of the open purchase: `?status=APPROVED&purchase=<id>`. */
export const PURCHASE_PARAM = 'purchase';

type Customer = { name: string; email: string } | null;

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * The purchase detail sheet of a list (W17): which purchase is open lives in the address next to
 * the list's own filters, so the link can be shared, a reload keeps it and Back closes it. Opening
 * is a new history entry; closing removes the parameter in place. The admin API has no detail
 * read, so the purchase comes from the page on screen (`items`); a link to a purchase of another
 * page or filter opens as "not found".
 */
export function usePurchaseDetail<Item extends Authorization>(
  items: readonly Item[] | undefined,
  customerOf: (item: Item) => Customer,
) {
  const search = useUrlSearch();
  const openId = useMemo(() => new URLSearchParams(search).get(PURCHASE_PARAM), [search]);
  const item = openId === null ? undefined : items?.find((candidate) => candidate.id === openId);
  const detail = useMemo(
    () => (item ? toPurchaseDetail(item, customerOf(item)) : null),
    [item, customerOf],
  );
  return {
    isOpen: openId !== null,
    detail,
    isLoading: openId !== null && items === undefined,
    isNotFound: openId !== null && items !== undefined && item === undefined,
    /** A real link (new tab, copy link); relative, so it stays on this page and locale. */
    hrefFor: (purchaseId: string) => withSearchParam(search, PURCHASE_PARAM, purchaseId),
    onLinkClick: (purchaseId: string) => (event: MouseEvent) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      pushSearch(withSearchParam(window.location.search, PURCHASE_PARAM, purchaseId));
    },
    close: () => replaceSearch(withSearchParam(window.location.search, PURCHASE_PARAM, undefined)),
  };
}

export type PurchaseDetailView = ReturnType<typeof usePurchaseDetail>;
