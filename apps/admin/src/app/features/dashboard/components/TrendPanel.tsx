import { EmptyState, ErrorState, Panel } from '@acme/ui';
import { RowsSkeleton } from '@/app/components/RowsSkeleton';
import { SectionTitle } from '@/app/components/SectionTitle';
import { TrendChart } from '@/app/components/UI/TrendChart';
import { t } from '@/app/i18n';
import type { TrendPanelView } from '../hooks/useDashboard';

/** Purchases over time from the newest page, approved vs declined, with its legend in words. */
export function TrendPanel({ trend }: { trend: TrendPanelView }) {
  return (
    <Panel labelledBy="trend-title" density="compact">
      <div className="flex flex-col gap-1">
        <SectionTitle id="trend-title">{t('dashboard.trend.title')}</SectionTitle>
        <p className="text-small text-muted">{trend.caption}</p>
      </div>
      {trend.state.isLoading && <RowsSkeleton label={t('dashboard.trend.loading')} />}
      {!trend.state.isLoading && trend.state.isError && (
        <ErrorState
          title={t('dashboard.trend.failed')}
          body={t('purchases.loadFailedBody')}
          retryLabel={t('common.retry')}
          retryingLabel={t('common.retrying')}
          onRetry={trend.state.retry}
          isRetrying={trend.state.isRetrying}
        />
      )}
      {trend.isEmpty && (
        <EmptyState
          title={t('dashboard.trend.emptyTitle')}
          body={t('dashboard.trend.emptyBody')}
          headingLevel={3}
        />
      )}
      {trend.chart && (
        <>
          <ul
            className="flex flex-wrap gap-x-5 gap-y-1 text-small"
            aria-label={t('dashboard.trend.legend')}
          >
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-sm border border-ink bg-success" />
              {t('dashboard.trend.approvedTotal', { count: trend.chart.approved })}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-sm border border-ink bg-danger" />
              {t('dashboard.trend.declinedTotal', { count: trend.chart.declined })}
            </li>
          </ul>
          <TrendChart
            summary={trend.chart.summary}
            bars={trend.chart.bars}
            maxLabel={trend.chart.maxLabel}
          />
        </>
      )}
    </Panel>
  );
}
