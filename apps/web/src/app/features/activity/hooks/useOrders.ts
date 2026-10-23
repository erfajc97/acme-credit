import { toOrderRow, type OrderRow } from '@/app/helpers/orders';
import { LIST_PAGE_PARAMS } from '@/app/helpers/pageParam';
import { t } from '@/app/i18n';
import { useAccountQuery } from '@/app/tanstack-queries/accountQuery';
import { useAuthorizationsQuery } from '@/app/tanstack-queries/authorizationsQuery';
import { orderHref } from '@/app/helpers/orderParam';
import { useVoidOrderMutation } from '../mutations/useVoidOrderMutation';
import { useListPager } from '@/app/hooks/useListPager';

export interface OrderListRow extends OrderRow {
  /** `?order=<id>`: the order's own address (shareable; a plain click opens the sheet in place). */
  detailHref: string;
}

/**
 * The account's orders, 10 per numbered page (`?ordersPage=`), polled briefly while one is on
 * hold, with "Cancel" on holds.
 */
export function useOrders(accountId: string | undefined) {
  const pager = useListPager(LIST_PAGE_PARAMS.orders);
  const query = useAuthorizationsQuery(accountId, pager.page);
  const cancelMutation = useVoidOrderMutation();
  // The same cached account query the page reads: no extra request.
  const cardToken = useAccountQuery().data?.card?.token;
  const orders = query.data?.items ?? [];
  const rows = orders.map((item): OrderListRow => ({
    ...toOrderRow(item),
    detailHref: orderHref(item.id),
  }));
  return {
    orders,
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    // A page past the end has no rows but the list is not empty: the pager leads back.
    isEmpty: query.data?.total === 0,
    // refetch never rejects: a failure lands in the query state, shown by the error branch.
    retry: () => void query.refetch(),
    isRetrying: query.isFetching,
    bindHeading: pager.bindHeading,
    pager: pager.view({ query, nav: t('activity.orders.pagesLabel') }),
    // Holds exist only on an account with a card; without one the network refuses (422) and the
    // failure toast shows.
    cancel: (row: OrderRow) =>
      cancelMutation.mutate({
        authorizationId: row.id,
        cardToken: cardToken ?? '',
        amount: row.amount,
        merchant: row.merchant,
      }),
    cancellingId: cancelMutation.isPending ? cancelMutation.variables.authorizationId : null,
  };
}
