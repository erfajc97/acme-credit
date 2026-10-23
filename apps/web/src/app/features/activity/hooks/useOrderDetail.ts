import type { Authorization } from '@acme/contracts';
import type { MouseEvent } from 'react';
import { detailFromListItem, toOrderDetail, type OrderDetail } from '@/app/helpers/orders';
import { ApiError } from '@/app/lib/apiClient';
import { useAuthorizationDetailQuery } from '@/app/tanstack-queries/authorizationDetailQuery';
import { isPlainClick } from '@/app/helpers/orderParam';
import { useOrderParam } from './useOrderParam';

export type OrderDetailState = 'loading' | 'error' | 'notFound' | 'ready';

interface OrderDetailInput {
  accountId: string | undefined;
  /** The orders already loaded by the list: an order among them opens at once. */
  orders: readonly Authorization[];
}

/**
 * The order detail sheet: which order (from `?order=`), its data (GET …/authorizations/:id, seeded
 * from the list row so it opens instantly), and the ways to open (a tap on an order or a purchase,
 * a shared link) and close it (close button, Esc, Back).
 */
export function useOrderDetail({ accountId, orders }: OrderDetailInput) {
  const param = useOrderParam();
  const listed =
    param.orderId === null ? undefined : orders.find((order) => order.id === param.orderId);
  const query = useAuthorizationDetailQuery({
    accountId,
    authorizationId: param.orderId,
    placeholder: listed && accountId ? detailFromListItem(listed, accountId) : undefined,
  });
  let state: OrderDetailState = 'loading';
  if (query.data) state = 'ready';
  else if (query.error instanceof ApiError && query.error.status === 404) state = 'notFound';
  else if (query.isError) state = 'error';
  const detail: OrderDetail | null = query.data ? toOrderDetail(query.data) : null;
  return {
    isOpen: param.orderId !== null,
    state,
    detail,
    /** The list row only knows when it was ordered: the step-by-step waits for the real detail. */
    showTimeline: !query.isPlaceholderData,
    // refetch never rejects: a failure lands in the query state, shown by the error branch.
    retry: () => void query.refetch(),
    isRetrying: query.isFetching,
    /** An order's link: a plain click opens the sheet in place, a modified one is the browser's. */
    openFromLink: (event: MouseEvent, orderId: string) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      param.open(orderId);
    },
    onOpenChange: (isOpen: boolean) => {
      if (!isOpen) param.close();
    },
  };
}
