import { ErrorState, InlineNotice, Skeleton } from '@acme/ui';
import { t } from '@/app/i18n';
import { useDepositFlow } from '../hooks/useDepositFlow';
import { AmountForm } from './AmountForm';
import { TransferStatus } from './TransferStatus';

interface DepositPanelProps {
  accountId: string;
  /** Confirmed deposit, integer cents (the room left under the per-account cap). */
  collateralCents: string;
  submitLabel: string;
  onDone?: () => void;
}

/** The security deposit: amount (within the range and the room left), then the bank approval. */
export function DepositPanel({
  accountId,
  collateralCents,
  submitLabel,
  onDone,
}: DepositPanelProps) {
  const flow = useDepositFlow(accountId, collateralCents);
  if (flow.watch.isLoading) return <Skeleton className="h-28 w-full rounded-card" />;
  if (flow.watch.isError) {
    return (
      <ErrorState
        title={t('transfer.loadFailedTitle')}
        body={t('transfer.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={flow.watch.retry}
        isRetrying={flow.watch.isRefreshing}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {flow.watch.state !== 'idle' && (
        <TransferStatus
          kind="deposit"
          state={flow.watch.state}
          amount={flow.trackedAmount}
          approveUrl={flow.approveUrl}
          onCheckAgain={flow.watch.checkAgain}
          isRefreshing={flow.watch.isRefreshing}
          onDone={onDone}
        />
      )}
      {flow.showForm && !flow.canDeposit && (
        <InlineNotice tone="neutral" title={t('deposit.capReachedTitle')}>
          {t('deposit.capReachedBody', flow.room)}
        </InlineNotice>
      )}
      {flow.showForm && flow.canDeposit && (
        <AmountForm
          control={flow.control}
          onSubmit={flow.onSubmit}
          label={t('deposit.amountLabel')}
          description={flow.hint}
          submitLabel={submitLabel}
          pendingLabel={t('deposit.submitting')}
          isSubmitting={flow.isSubmitting}
        />
      )}
    </div>
  );
}
