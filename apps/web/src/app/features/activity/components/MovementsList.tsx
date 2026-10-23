import { EmptyState, ErrorState, LedgerRow, Skeleton, StatusChip } from '@acme/ui';
import type { MouseEvent } from 'react';
import { t } from '@/app/i18n';
import type { ActivityRow } from '../hooks/useActivityPage';

interface MovementsListProps {
  rows: ActivityRow[];
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  isRetrying: boolean;
  onOpenOrder: (event: MouseEvent, orderId: string) => void;
}

/** Every money movement of the ledger as rows (cards on phones), 10 per page; a purchase opens its order. */
export function MovementsList(props: MovementsListProps) {
  if (props.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-14 w-full rounded-field" />
        <Skeleton className="h-14 w-full rounded-field" />
      </div>
    );
  }
  if (props.isError) {
    return (
      <ErrorState
        title={t('activity.loadFailedTitle')}
        body={t('activity.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={props.onRetry}
        isRetrying={props.isRetrying}
      />
    );
  }
  if (props.isEmpty) {
    return (
      <EmptyState
        headingLevel={3}
        title={t('activity.emptyTitle')}
        body={t('activity.emptyBody')}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {props.rows.map((row) => (
          <LedgerRow
            key={row.id}
            primary={row.title}
            secondary={row.detail}
            amount={row.amount}
            status={<StatusChip tone={row.tone} label={row.statusLabel} />}
            link={
              row.detailHref
                ? { href: row.detailHref, onClick: (event) => props.onOpenOrder(event, row.id) }
                : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}
