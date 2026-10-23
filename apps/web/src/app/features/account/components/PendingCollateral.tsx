import { Panel, StatusChip } from '@acme/ui';
import { t } from '@/app/i18n';
import { DepositPanel } from './DepositPanel';

interface PendingCollateralProps {
  accountId: string;
}

/** The account waits for its first security deposit; the card activates once the bank confirms. */
export function PendingCollateral({ accountId }: PendingCollateralProps) {
  return (
    <Panel labelledBy="deposit-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="deposit-title" className="font-display text-h2 font-semibold md:text-h2-lg">
          {t('deposit.title')}
        </h2>
        <StatusChip tone="warning" label={t('status.awaitingDeposit')} />
      </div>
      <p className="max-w-prose text-body text-muted">{t('deposit.intro')}</p>
      <DepositPanel accountId={accountId} collateralCents="0" submitLabel={t('deposit.submit')} />
    </Panel>
  );
}
