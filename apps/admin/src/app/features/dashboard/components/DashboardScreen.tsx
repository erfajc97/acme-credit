import { AppButton, ErrorState, InlineNotice } from '@acme/ui';
import { RefreshCw } from 'lucide-react';
import { Icon } from '@/app/components/UI/Icon';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import { useDashboard } from '../hooks/useDashboard';
import { AccountsByStatus } from './AccountsByStatus';
import { AlertsPanel } from './AlertsPanel';
import { KpiGrid } from './KpiGrid';
import { LedgerSignal } from './LedgerSignal';
import { RecentPurchases } from './RecentPurchases';
import { ReconciliationSignal } from './ReconciliationSignal';
import { TrendPanel } from './TrendPanel';

export function DashboardScreen() {
  const dashboard = useDashboard();
  if (dashboard.isLoading)
    return <PageSkeleton label={t('dashboard.loading')} variant="dashboard" />;
  if (dashboard.isError || !dashboard.view) {
    return (
      <ErrorState
        title={t('dashboard.loadFailedTitle')}
        body={t('dashboard.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={dashboard.refresh}
        isRetrying={dashboard.isRefreshing}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      {!dashboard.view.reconciliation.isClean && (
        <ReconciliationSignal view={dashboard.view.reconciliation} />
      )}
      {dashboard.ledgerAlert && (
        <LedgerSignal ledger={dashboard.ledgerAlert} ledgerHref={dashboard.ledgerHref} />
      )}
      <div className="flex items-center justify-between gap-2">
        {dashboard.view.reconciliation.isClean && (
          <ReconciliationSignal view={dashboard.view.reconciliation} />
        )}
        <AppButton
          variant="secondary"
          size="compact"
          onPress={dashboard.refresh}
          isPending={dashboard.isRefreshing}
          pendingLabel={t('dashboard.refreshing')}
        >
          <Icon icon={RefreshCw} size={16} />
          {/* Phones: the icon alone; the word stays its accessible name. */}
          <span className="max-sm:sr-only">{t('dashboard.refresh')}</span>
        </AppButton>
      </div>
      {dashboard.refreshFailed && (
        <InlineNotice tone="warning" title={t('dashboard.refreshFailedTitle')}>
          {t('dashboard.refreshFailedBody')}
        </InlineNotice>
      )}
      <KpiGrid view={dashboard.view} holds={dashboard.holds} payouts={dashboard.payouts} />
      <div className="grid grid-cols-1 items-start gap-3 sm:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TrendPanel trend={dashboard.purchases.trend} />
        <AlertsPanel alerts={dashboard.alerts} />
      </div>
      <div className="grid grid-cols-1 items-start gap-3 sm:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RecentPurchases purchases={dashboard.purchases} />
        <AccountsByStatus view={dashboard.view} />
      </div>
    </div>
  );
}
