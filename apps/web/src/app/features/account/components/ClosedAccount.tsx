import type { Account } from '@acme/contracts';
import { AmountStat, AppButton, ErrorState, Panel, Skeleton, StatusChip } from '@acme/ui';
import { t } from '@/app/i18n';
import { useClosedAccount } from '../hooks/useClosedAccount';

interface ClosedAccountProps {
  account: Account;
}

/** A closed account: what happened to the security deposit, and how to start again. */
export function ClosedAccount({ account }: ClosedAccountProps) {
  const closed = useClosedAccount(account);
  return (
    <Panel labelledBy="closed-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="closed-title" className="font-display text-h2 font-semibold md:text-h2-lg">
          {t('closed.title')}
        </h2>
        <StatusChip tone="neutral" label={t('status.closed')} />
      </div>
      {closed.isLoading && <Skeleton className="h-24 w-full rounded-card" />}
      {closed.isError && (
        <ErrorState
          title={t('closed.loadFailedTitle')}
          body={t('closed.loadFailedBody')}
          retryLabel={t('common.retry')}
          retryingLabel={t('common.retrying')}
          onRetry={closed.retry}
          isRetrying={closed.isRetrying}
        />
      )}
      {closed.settlement && (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AmountStat label={t('closed.deposit')} value={closed.settlement.collateral} />
          <AmountStat label={t('closed.applied')} value={closed.settlement.applied} />
          <AmountStat label={t('closed.returned')} value={closed.settlement.released} />
        </dl>
      )}
      <p className="max-w-prose text-body text-muted">{t('closed.body')}</p>
      <AppButton
        fullWidth
        onPress={closed.openNew}
        isPending={closed.isOpening}
        pendingLabel={t('account.onboarding.opening')}
      >
        {t('closed.openNew')}
      </AppButton>
    </Panel>
  );
}
