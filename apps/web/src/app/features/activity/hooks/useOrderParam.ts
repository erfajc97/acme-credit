import { useSyncExternalStore } from 'react';
import { orderUrl, readOrderParam } from '@/app/helpers/orderParam';
import { currentHistoryState, subscribeAddress, writeAddress } from '@/app/hooks/listAddress';

/** Marks the history entry the sheet pushed, so closing it can step back onto the list. */
const SHEET_ENTRY = 'acmeOrderSheet';

/**
 * The order whose detail sheet is open, kept in `?order=<id>` (W17 style: one parser,
 * readOrderParam). Opening pushes a history entry, so the browser's Back closes the sheet; a
 * shared link opens it on load.
 */
export function useOrderParam() {
  const orderId = useSyncExternalStore(
    subscribeAddress,
    () => readOrderParam(window.location.search),
    () => null,
  );
  return {
    orderId,
    open: (id: string) => {
      // Astro's own entry data (index, scroll) is kept so its later navigations stay consistent.
      writeAddress({
        kind: 'push',
        state: { ...currentHistoryState(), [SHEET_ENTRY]: true },
        url: orderUrl(window.location.href, id),
      });
    },
    close: () => {
      const state = currentHistoryState();
      if (state?.[SHEET_ENTRY]) {
        // This entry was pushed by `open` from this very list, so the previous entry IS the list:
        // stepping back closes the sheet and leaves no dead "forward" entry. Not the W17 way back
        // (that one never trusts history): here the marker proves where Back lands.
        window.history.back();
        return;
      }
      // Opened from a shared link: there is no list entry behind it, so the address is cleaned in place.
      const { [SHEET_ENTRY]: _marker, ...rest } = state ?? {};
      writeAddress({
        kind: 'replace',
        state: state ? rest : null,
        url: orderUrl(window.location.href, null),
      });
    },
  };
}
