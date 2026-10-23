import { EmptyState, ErrorState, Skeleton } from '@acme/ui';
import { t } from '@/app/i18n';
import { usePaymentFlow } from '../hooks/usePaymentFlow';
import { AmountForm } from './AmountForm';
import { TransferStatus } from './TransferStatus';

interface PaymentPanelProps {
  accountId: string;
  postedDebtCents: string;
  onDone: () => void;
}

/** A payment of what is owed: never more than that, approved at the bank. */
export function PaymentPanel({ accountId, postedDebtCents, onDone }: PaymentPanelProps) {
  const flow = usePaymentFlow(accountId, postedDebtCents);
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
          kind="repayment"
          state={flow.watch.state}
          amount={flow.trackedAmount}
          approveUrl={flow.approveUrl}
          onCheckAgain={flow.watch.checkAgain}
          isRefreshing={flow.watch.isRefreshing}
          onDone={onDone}
        />
      )}
      {flow.showForm && !flow.hasDebt && (
        <EmptyState
          headingLevel={3}
          title={t('payment.noDebtTitle')}
          body={t('payment.noDebtBody')}
        />
      )}
      {flow.showForm && flow.hasDebt && (
        <AmountForm
          control={flow.control}
          onSubmit={flow.onSubmit}
          label={t('payment.amountLabel')}
          description={t('payment.amountHint', { owed: flow.owed })}
          submitLabel={t('payment.submit')}
          pendingLabel={t('payment.submitting')}
          isSubmitting={flow.isSubmitting}
        />
      )}
    </div>
  );
}
