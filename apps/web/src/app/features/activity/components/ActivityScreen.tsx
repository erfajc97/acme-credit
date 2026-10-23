import { ButtonLink, EmptyState, ErrorState } from '@acme/ui';
import { ListHeading } from '@/app/components/ListHeading';
import { ListPager } from '@/app/components/ListPager';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import { useActivityPage } from '../hooks/useActivityPage';
import { MovementsList } from './MovementsList';
import { OrderDetailSheet } from './OrderDetailSheet';
import { OrdersList } from './OrdersList';

const COLUMN =
  'flex min-w-0 scroll-mt-24 flex-col gap-3 rounded-card border-[1.6px] border-ink bg-surface-raised p-4 shadow-raised sm:p-[clamp(1rem,2.8dvh,2rem)]';

/**
 * Orders and ledger movements, 10 rows per numbered page each: stacked on phones and tablets, side
 * by side from lg. No inner scroll boxes: ten rows fit a column and the page itself scrolls when
 * they do not. An order opens its detail sheet, deep-linked as `?order=<id>`.
 */
export function ActivityScreen() {
  const page = useActivityPage();
  if (page.isLoading) return <PageSkeleton label={t('activity.loading')} />;
  if (page.isError) {
    return (
      <ErrorState
        title={t('account.loadFailedTitle')}
        body={t('account.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={page.retry}
        isRetrying={page.isRetrying}
      />
    );
  }
  if (!page.hasAccount) {
    return (
      <EmptyState
        title={t('activity.emptyTitle')}
        body={t('activity.emptyBody')}
        action={<ButtonLink href={page.walletHref}>{t('common.backToAccount')}</ButtonLink>}
      />
    );
  }
  const { orders, movements, detail } = page;
  return (
    <div className="grid gap-[clamp(0.75rem,2.4dvh,1.75rem)] lg:grid-cols-2 lg:items-start lg:gap-8">
      <section data-tour="activity-orders" aria-labelledby="orders-title" className={COLUMN}>
        <ListHeading
          id="orders-title"
          bind={orders.bindHeading}
          className="scroll-mt-24 rounded-field font-display text-h3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
        >
          {t('activity.orders.title')}
        </ListHeading>
        <OrdersList
          rows={orders.rows}
          isLoading={orders.isLoading}
          isError={orders.isError}
          isEmpty={orders.isEmpty}
          onRetry={orders.retry}
          isRetrying={orders.isRetrying}
          onCancel={orders.cancel}
          cancellingId={orders.cancellingId}
          onOpen={detail.openFromLink}
        />
        <ListPager pager={orders.pager} />
      </section>
      <section aria-labelledby="movements-title" className={COLUMN}>
        <ListHeading
          id="movements-title"
          bind={movements.bindHeading}
          className="scroll-mt-24 rounded-field font-display text-h3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
        >
          {t('activity.listTitle')}
        </ListHeading>
        <MovementsList
          rows={movements.rows}
          isLoading={movements.isLoading}
          isError={movements.isError}
          isEmpty={movements.isEmpty}
          onRetry={movements.retry}
          isRetrying={movements.isRetrying}
          onOpenOrder={detail.openFromLink}
        />
        <ListPager pager={movements.pager} />
      </section>
      <OrderDetailSheet
        isOpen={detail.isOpen}
        onOpenChange={detail.onOpenChange}
        state={detail.state}
        detail={detail.detail}
        onRetry={detail.retry}
        isRetrying={detail.isRetrying}
        showTimeline={detail.showTimeline}
      />
    </div>
  );
}
