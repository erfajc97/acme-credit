import { AppSheet, ErrorState, Skeleton } from '@acme/ui';
import type { OrderDetail } from '@/app/helpers/orders';
import { t } from '@/app/i18n';
import type { OrderDetailState } from '../hooks/useOrderDetail';
import { OrderDetailBody } from './OrderDetailBody';

interface OrderDetailSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  state: OrderDetailState;
  detail: OrderDetail | null;
  onRetry: () => void;
  isRetrying: boolean;
  showTimeline: boolean;
}

/** The sheet's body for each state of the order's data (W13). */
function sheetBody({
  state,
  detail,
  onRetry,
  isRetrying,
  showTimeline,
}: Omit<OrderDetailSheetProps, 'isOpen' | 'onOpenChange'>) {
  if (state === 'ready' && detail)
    return <OrderDetailBody detail={detail} showTimeline={showTimeline} />;
  if (state === 'notFound') {
    return (
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-body font-bold">{t('activity.detail.notFoundTitle')}</h3>
        <p className="text-small text-muted">{t('activity.detail.notFoundBody')}</p>
      </div>
    );
  }
  if (state === 'error') {
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
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{t('activity.detail.loading')}</span>
      <Skeleton className="h-16 w-full rounded-field" />
      <Skeleton className="h-28 w-full rounded-field" />
    </div>
  );
}

/**
 * One order in full: merchant, date, status, every line (quantity × unit price, line total), the
 * total and what happened to the money. A bottom sheet on phones, a side panel from lg.
 */
export function OrderDetailSheet({ isOpen, onOpenChange, ...body }: OrderDetailSheetProps) {
  return (
    <AppSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('activity.detail.title')}
      closeLabel={t('common.close')}
      placement="auto"
    >
      {sheetBody(body)}
    </AppSheet>
  );
}
