import type { Activity } from '@acme/contracts';
import type { StatusTone } from '@acme/ui';
import { formatDateTime } from '@/app/helpers/dates';
import { formatAmount } from '@/app/helpers/money';
import { localHref } from '@/app/helpers/navigation';
import { activityStatus } from '@/app/helpers/statusLabels';
import { t } from '@/app/i18n';
import { ROUTES } from '@/app/lib/endpoints';
import { useAccountQuery } from '@/app/tanstack-queries/accountQuery';
import { useActivityQuery } from '@/app/tanstack-queries/activityQuery';
import { activityTitle } from '../helpers/activityTitle';
import { orderHref } from '@/app/helpers/orderParam';
import { LIST_PAGE_PARAMS } from '@/app/helpers/pageParam';
import { useListPager } from '@/app/hooks/useListPager';
import { useOrderDetail } from './useOrderDetail';
import { useOrders } from './useOrders';

export interface ActivityRow {
  id: string;
  title: string;
  detail: string;
  amount: string;
  statusLabel: string;
  tone: StatusTone;
  /** A purchase opens its order detail (its id is the order's); other movements have no detail. */
  detailHref: string | null;
}

/** One ledger line: what moved (in the page language), when, how much, and its status in words. */
export function toActivityRow(item: Activity): ActivityRow {
  const status = activityStatus(item.status);
  return {
    id: item.id,
    title: activityTitle(item),
    detail: formatDateTime(item.createdAt),
    amount: formatAmount(item.amountCents),
    statusLabel: t(status.labelKey),
    tone: status.tone,
    detailHref: item.type === 'purchase' ? orderHref(item.id) : null,
  };
}

/** The ledger movements, 10 per numbered page (`?movementsPage=`; W13: loading, empty, error with retry). */
function useMovements(accountId: string | undefined) {
  const pager = useListPager(LIST_PAGE_PARAMS.movements);
  const activity = useActivityQuery(accountId, pager.page);
  const rows = (activity.data?.items ?? []).map(toActivityRow);
  return {
    rows,
    isLoading: activity.isLoading,
    isError: activity.isError,
    // A page past the end has no rows but the list is not empty: the pager leads back.
    isEmpty: activity.data?.total === 0,
    // refetch never rejects: failures land in the query state, shown by the error branch.
    retry: () => void activity.refetch(),
    isRetrying: activity.isFetching,
    bindHeading: pager.bindHeading,
    pager: pager.view({ query: activity, nav: t('activity.pagesLabel') }),
  };
}

/** The activity page: the account first, then its orders and its ledger movements side by side. */
export function useActivityPage() {
  const account = useAccountQuery();
  const accountId = account.data?.id;
  const orders = useOrders(accountId);
  return {
    isLoading: account.isLoading,
    isError: account.isError,
    retry: () => void account.refetch(),
    isRetrying: account.isFetching,
    hasAccount: Boolean(accountId),
    walletHref: localHref(ROUTES.app),
    orders,
    movements: useMovements(accountId),
    detail: useOrderDetail({ accountId, orders: orders.orders }),
  };
}
