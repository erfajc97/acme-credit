import { EmptyState, ErrorState, LedgerRow, ScrollPanel, Skeleton, StatusChip } from '@acme/ui';
import type { OrderRow } from '@/app/helpers/orders';
import { t } from '@/app/i18n';

interface RecentOrdersProps {
  rows: (OrderRow & { href: string })[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isRetrying: boolean;
  activityHref: string;
}

/** The newest orders on the wallet home, each with its status in words; all of them in Activity. */
export function RecentOrders({
  rows,
  isLoading,
  isError,
  onRetry,
  isRetrying,
  activityHref,
}: RecentOrdersProps) {
  let body;
  if (isLoading) {
    body = (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-12 w-full rounded-field" />
        <Skeleton className="h-12 w-full rounded-field" />
      </div>
    );
  } else if (isError) {
    body = (
      <ErrorState
        title={t('activity.orders.loadFailedTitle')}
        body={t('activity.orders.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        headingLevel={3}
        title={t('account.recent.emptyTitle')}
        body={t('account.recent.emptyBody')}
      />
    );
  } else {
    body = (
      <ScrollPanel label={t('account.recent.title')} className="flex-1 pr-1">
        <ul className="flex flex-col">
          {rows.map((row) => (
            <LedgerRow
              key={row.id}
              primary={row.title}
              secondary={row.detail}
              amount={row.amount}
              status={<StatusChip tone={row.tone} label={t(row.statusKey)} />}
              link={{ href: row.href }}
            />
          ))}
        </ul>
      </ScrollPanel>
    );
  }
  return (
    <section
      aria-labelledby="recent-title"
      className="flex min-h-0 flex-col gap-2 rounded-card border-[1.6px] border-ink bg-surface-raised p-4 shadow-raised sm:p-[clamp(1rem,3.2dvh,2.5rem)] lg:h-full"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="recent-title" className="font-display text-body font-bold sm:text-h3">
          {t('account.recent.title')}
        </h2>
        <a
          href={activityHref}
          className="inline-flex min-h-11 items-center text-small font-semibold text-violet underline underline-offset-4"
        >
          {t('account.recent.seeAll')}
        </a>
      </div>
      {body}
    </section>
  );
}
