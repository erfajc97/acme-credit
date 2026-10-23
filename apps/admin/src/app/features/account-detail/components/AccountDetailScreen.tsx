import { ButtonLink, EmptyState, ErrorState } from '@acme/ui';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { PurchaseDetailSheet } from '@/app/components/PurchaseDetailSheet';
import { ReleaseHoldDialog } from '@/app/components/ReleaseHoldDialog';
import { t } from '@/app/i18n';
import { useAccountDetail } from '../hooks/useAccountDetail';
import { AccountHeader } from './AccountHeader';
import { AccountHistory } from './AccountHistory';
import { ActionsPanel } from './ActionsPanel';
import { BalancesPanel } from './BalancesPanel';
import { PayoutsPanel } from './PayoutsPanel';

export function AccountDetailScreen() {
  const detail = useAccountDetail();
  if (detail.isNotFound) {
    return (
      <EmptyState
        title={t('accountDetail.notFoundTitle')}
        body={t('accountDetail.notFoundBody')}
        action={<ButtonLink href={detail.backHref}>{t('common.backToAccounts')}</ButtonLink>}
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton label={t('accountDetail.loading')} variant="detail" />;
  if (detail.isError || !detail.account || !detail.header || !detail.balances) {
    return (
      <ErrorState
        title={t('accountDetail.loadFailedTitle')}
        body={t('accountDetail.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={detail.retry}
        isRetrying={detail.isRetrying}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <AccountHeader header={detail.header} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <BalancesPanel balances={detail.balances} />
        <ActionsPanel account={detail.account} />
      </div>
      <PayoutsPanel rows={detail.payouts} />
      <AccountHistory
        history={detail.history}
        onRelease={detail.release.open}
        detail={detail.detail}
      />
      <ReleaseHoldDialog release={detail.release} />
      <PurchaseDetailSheet view={detail.detail} />
    </div>
  );
}
