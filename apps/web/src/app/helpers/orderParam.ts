import { idSchema } from '@acme/contracts';

/** `/app/activity?order=<id>` opens that order's detail sheet: shareable, and Back closes it. */
export const ORDER_PARAM = 'order';

/** The one parser of `?order=`: an order id, or null when absent or malformed. */
export function readOrderParam(search: string): string | null {
  const value = new URLSearchParams(search).get(ORDER_PARAM);
  return value !== null && idSchema.safeParse(value).success ? value : null;
}

/** An order's own link, relative to the list it sits on (no address needed at render time). */
export function orderHref(orderId: string): string {
  return `?${ORDER_PARAM}=${encodeURIComponent(orderId)}`;
}

/** The same address with `?order=<id>` (or without it, for null), as a path for the history API. */
export function orderUrl(href: string, orderId: string | null): string {
  const url = new URL(href);
  if (orderId === null) url.searchParams.delete(ORDER_PARAM);
  else url.searchParams.set(ORDER_PARAM, orderId);
  return `${url.pathname}${url.search}${url.hash}`;
}

interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** A plain primary click opens the sheet in place; with a modifier the browser opens a new tab or window. */
export function isPlainClick(event: ClickLike): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
