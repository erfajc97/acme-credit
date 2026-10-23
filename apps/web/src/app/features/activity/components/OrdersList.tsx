import { AmountText, AppButton, EmptyState, ErrorState, Skeleton, StatusChip } from '@acme/ui';
import { ChevronRight } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Icon } from '@/app/components/UI/Icon';
import type { OrderRow } from '@/app/helpers/orders';
import { t } from '@/app/i18n';
import type { OrderListRow } from '../hooks/useOrders';

interface OrdersListProps {
  rows: OrderListRow[];
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  isRetrying: boolean;
  onCancel: (row: OrderRow) => void;
  cancellingId: string | null;
  onOpen: (event: MouseEvent, orderId: string) => void;
}

/**
 * Orders newest first: "Taquería El Sol · 2 artículos", amount, status in words and the lines at a
 * glance. The whole order is a link to its detail (`?order=<id>`); "Cancel" only while on hold.
 */
export function OrdersList(props: OrdersListProps) {
  const { rows, isLoading, isError, isEmpty, onRetry, isRetrying, onCancel, cancellingId, onOpen } =
    props;
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-14 w-full rounded-field" />
        <Skeleton className="h-14 w-full rounded-field" />
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title={t('activity.orders.loadFailedTitle')}
        body={t('activity.orders.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    );
  }
  if (isEmpty) {
    return (
      <EmptyState
        headingLevel={3}
        title={t('activity.orders.emptyTitle')}
        body={t('activity.orders.emptyBody')}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0"
          >
            <a
              href={row.detailHref}
              onClick={(event) => onOpen(event, row.id)}
              className="-mx-2 flex min-h-11 items-start justify-between gap-4 rounded-field px-2 py-1.5 transition-colors duration-fast ease-out hover:bg-neutral-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-fg">{row.title}</span>
                <span className="text-small text-muted">{row.detail}</span>
                {row.preview && (
                  <span className="truncate text-small text-muted">{row.preview}</span>
                )}
                <span className="inline-flex items-center gap-0.5 text-small font-semibold text-violet">
                  {t('activity.orders.viewDetail')}
                  <Icon icon={ChevronRight} size={16} />
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <AmountText value={row.amount} />
                <StatusChip tone={row.tone} label={t(row.statusKey)} />
              </span>
            </a>
            {row.canCancel && (
              <div className="flex justify-end">
                <AppButton
                  variant="ghost"
                  size="compact"
                  onPress={() => onCancel(row)}
                  isPending={cancellingId === row.id}
                  pendingLabel={t('activity.orders.cancelling')}
                  aria-label={t('activity.orders.cancelLabel', {
                    amount: row.amount,
                    merchant: row.merchant,
                  })}
                >
                  {t('activity.orders.cancel')}
                </AppButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
