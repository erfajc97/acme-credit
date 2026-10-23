import type { UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { t } from '@/app/i18n';
import { localHref, ROUTES } from '@/app/lib/endpoints';
import { PAYOUTS_LIST, PURCHASES_LIST } from '@/app/helpers/listQuery';
import { formatCount } from '@/app/helpers/money';
import { toPurchaseRow } from '@/app/helpers/orders';
import {
  useDashboardQuery,
  usePayoutSampleQuery,
  usePurchaseSampleQuery,
} from '@/app/tanstack-queries/adminQueries';
import { RECENT_PURCHASES } from '../data';
import {
  alertItems,
  expiringHolds,
  hasMoreThanSample,
  heldTotal,
  purchaseTrend,
  sampleCount,
  trendChartView,
} from '../helpers/dashboardSamples';
import { toDashboardView } from '../helpers/dashboardView';
import type { KpiTone } from '../types';

/** The four states (W13) of one of the dashboard's side reads, apart from the figures. */
export interface SampleState {
  isLoading: boolean;
  /** Nothing to show because the read failed (a failed refresh keeps the last data). */
  isError: boolean;
  retry: () => void;
  isRetrying: boolean;
}

function stateOf(...queries: UseQueryResult[]): SampleState {
  return {
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError && !query.data),
    // refetch never rejects: failures land in the query state, shown by the error branch.
    retry: () => queries.forEach((query) => void query.refetch()),
    isRetrying: queries.some((query) => query.isFetching),
  };
}

const listHref = (path: string, search = '') => localHref(`${path}${search}`);

/** Holds about to lapse, measured at the moment the holds were read (not a ticking clock). */
function useHolds() {
  const query = usePurchaseSampleQuery('APPROVED');
  const expiring = useMemo(
    () => (query.data ? expiringHolds(query.data.items, query.dataUpdatedAt) : []),
    [query.data, query.dataUpdatedAt],
  );
  return {
    query,
    expiring,
    kpi: {
      state: stateOf(query),
      count: query.data ? sampleCount(query.data, expiring.length) : '',
      total: heldTotal(expiring),
      tone: (expiring.length > 0 ? 'warning' : 'neutral') as KpiTone,
      href: listHref(PURCHASES_LIST.path, PURCHASES_LIST.serialize({ status: 'APPROVED' })),
    },
  };
}

function usePayouts() {
  const pending = usePayoutSampleQuery('PENDING');
  const failed = usePayoutSampleQuery('FAILED');
  const failedCount = failed.data?.items.length ?? 0;
  const pendingCount = pending.data?.items.length ?? 0;
  // Failed needs a person (danger); pending is the worker's job (warning); none at all is calm.
  const tone: KpiTone = failedCount > 0 ? 'danger' : pendingCount > 0 ? 'warning' : 'success';
  return {
    failed,
    kpi: {
      state: stateOf(pending, failed),
      pending: pending.data ? sampleCount(pending.data) : '',
      failed: failed.data ? sampleCount(failed.data) : '',
      tone,
      // The failed ones need a person: the card opens them first when there are any.
      href: listHref(
        PAYOUTS_LIST.path,
        PAYOUTS_LIST.serialize({ status: failedCount > 0 ? 'FAILED' : 'PENDING' }),
      ),
    },
  };
}

/** The newest purchases: the trend chart and the recent table read the same page. */
function usePurchases() {
  const query = usePurchaseSampleQuery(null);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const state = stateOf(query);
  const isEmpty = query.isSuccess && items.length === 0;
  const trend = useMemo(() => purchaseTrend(items), [items]);
  return {
    state,
    trend: {
      state,
      isEmpty,
      // "Latest N purchases" when the list goes on, so a sample is never read as a total.
      caption:
        query.data && hasMoreThanSample(query.data)
          ? t(`dashboard.trend.captionLatest.${trend.unit}`, { count: formatCount(trend.count) })
          : t(`dashboard.trend.captionAll.${trend.unit}`),
      chart: useMemo(() => trendChartView(trend), [trend]),
    },
    recent: useMemo(() => items.slice(0, RECENT_PURCHASES).map(toPurchaseRow), [items]),
    isEmpty,
    // A section link opens the plain list (W17).
    allHref: listHref(PURCHASES_LIST.path),
  };
}

export type PurchasesView = ReturnType<typeof usePurchases>;
export type TrendPanelView = PurchasesView['trend'];
export type HoldsKpi = ReturnType<typeof useHolds>['kpi'];
export type PayoutsKpi = ReturnType<typeof usePayouts>['kpi'];

/**
 * The dashboard: the API's figures with their four states and a manual refresh (a re-read, not an
 * action), plus what it does not count, from the newest page of three lists: the purchase trend
 * and recent purchases, holds about to expire, and payouts pending or failed. Each side read has
 * its own states, so one failing never hides the figures.
 */
export function useDashboard() {
  const query = useDashboardQuery();
  const view = useMemo(() => (query.data ? toDashboardView(query.data) : null), [query.data]);
  const holds = useHolds();
  const payouts = usePayouts();
  const purchases = usePurchases();
  const failedItems = payouts.failed.data?.items;
  return {
    view,
    purchases,
    holds: holds.kpi,
    payouts: payouts.kpi,
    alerts: {
      state: stateOf(holds.query, payouts.failed),
      items: useMemo(
        () => alertItems(failedItems ?? [], holds.expiring),
        [failedItems, holds.expiring],
      ),
    },
    // The ledger only speaks up when it does not balance: a balanced ledger is the normal state.
    ledgerAlert: view && !view.ledger.isBalanced ? view.ledger : null,
    ledgerHref: localHref(ROUTES.ledger),
    isLoading: query.isLoading,
    isError: query.isError && !query.data,
    // A failed refresh keeps the last figures on screen and says they may be stale.
    refreshFailed: query.isError && Boolean(query.data),
    // Refresh re-reads everything on screen; refetch never rejects (failures land in each state).
    refresh: () => {
      void query.refetch();
      for (const state of [purchases.state, holds.kpi.state, payouts.kpi.state]) state.retry();
    },
    isRefreshing: query.isFetching,
  };
}

export type DashboardScreenView = ReturnType<typeof useDashboard>;
