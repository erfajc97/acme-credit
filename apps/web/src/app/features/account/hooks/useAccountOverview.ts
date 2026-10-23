import type { Account } from '@acme/contracts';
import type { VaultSegment } from '@acme/ui';
import { formatAmount, percentOf } from '@/app/helpers/money';
import { localHref } from '@/app/helpers/navigation';
import { orderHref } from '@/app/helpers/orderParam';
import { toOrderRow } from '@/app/helpers/orders';
import { useDisclosure } from '@/app/hooks/useDisclosure';
import { t } from '@/app/i18n';
import { ROUTES } from '@/app/lib/endpoints';
import { useAuthStore } from '@/app/store/authStore';
import { useAuthorizationsQuery } from '@/app/tanstack-queries/authorizationsQuery';

/** The wallet home shows the newest orders only (its panel scrolls); Activity has them all. */
const HOME_RECENT_ORDERS = 6;

/** The vault meter's segments: the credit limit split into owed · on hold · available. */
export function meterSegments(account: Account): VaultSegment[] {
  const limit = account.creditLimitCents;
  return [
    {
      id: 'owed',
      label: t('account.balances.owed'),
      amount: formatAmount(account.postedDebtCents),
      percent: percentOf(account.postedDebtCents, limit),
      tone: 'owed',
    },
    {
      id: 'held',
      label: t('account.balances.onHold'),
      amount: formatAmount(account.heldCents),
      percent: percentOf(account.heldCents, limit),
      tone: 'held',
    },
    {
      id: 'available',
      label: t('account.balances.available'),
      amount: formatAmount(account.availableCents),
      percent: percentOf(account.availableCents, limit),
      tone: 'available',
    },
  ];
}

/**
 * The wallet home of an open account (active or frozen): usage only — what is available, the
 * limit and how it is used, the quick actions and the recent orders. The card's settings live on
 * the card page; the home shows a summary of the card that links there.
 */
export function useAccountOverview(account: Account) {
  // The first page of orders: the same cache entry the Activity page opens on.
  const orders = useAuthorizationsQuery(account.id, 1);
  const paymentDialog = useDisclosure();
  const depositDialog = useDisclosure();
  const firstName = useAuthStore((state) => state.user?.fullName.split(' ')[0] ?? '');
  const isFrozen = account.status === 'FROZEN';
  const recent = (orders.data?.items ?? [])
    .slice(0, HOME_RECENT_ORDERS)
    // Each opens its detail on the Activity page (`?order=<id>`), through the ClientRouter.
    .map((item) => ({
      ...toOrderRow(item),
      href: `${localHref(ROUTES.activity)}${orderHref(item.id)}`,
    }));

  return {
    greeting: firstName ? t('account.greeting', { name: firstName }) : '',
    isFrozen,
    card: account.card,
    cardStatus: isFrozen
      ? { label: t('status.frozen'), tone: 'warning' as const }
      : { label: t('status.active'), tone: 'success' as const },
    balances: {
      available: formatAmount(account.availableCents),
      limit: formatAmount(account.creditLimitCents),
      onHold: formatAmount(account.heldCents),
      owed: formatAmount(account.postedDebtCents),
      collateral: formatAmount(account.collateralCents),
    },
    segments: meterSegments(account),
    paymentDialog,
    depositDialog,
    recent: {
      rows: recent,
      isLoading: orders.isLoading,
      isError: orders.isError,
      // refetch never rejects: a failure lands in the query state, shown by the error branch.
      retry: () => void orders.refetch(),
      isRetrying: orders.isFetching,
    },
    hrefs: {
      store: localHref(ROUTES.store),
      activity: localHref(ROUTES.activity),
      card: localHref(ROUTES.card),
    },
  };
}
