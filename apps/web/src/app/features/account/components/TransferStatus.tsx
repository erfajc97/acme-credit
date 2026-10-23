import { AppButton, ButtonLink, InlineNotice, PendingIndicator } from '@acme/ui';
import { ExternalLink } from 'lucide-react';
import { Icon } from '@/app/components/UI/Icon';
import { t } from '@/app/i18n';
import type { PaymentKind } from '@/app/tanstack-queries/paymentsQuery';
import { TRANSFER_COPY } from '../data';
import type { WatchState } from '../hooks/usePaymentWatch';

interface TransferStatusProps {
  kind: PaymentKind;
  state: WatchState;
  amount: string;
  approveUrl: string | null;
  onCheckAgain: () => void;
  isRefreshing: boolean;
  /** Shown after a confirmation, e.g. to close the dialog. */
  onDone?: (() => void) | undefined;
}

/** Where a transfer stands at the bank: waiting, not heard back, confirmed or failed. */
export function TransferStatus({
  kind,
  state,
  amount,
  approveUrl,
  onCheckAgain,
  isRefreshing,
  onDone,
}: TransferStatusProps) {
  const copy = TRANSFER_COPY[kind];
  if (state === 'confirmed') {
    return (
      <div className="flex flex-col gap-3">
        <InlineNotice tone="success" title={t(copy.confirmedTitle, { amount })}>
          {t(copy.confirmedBody)}
        </InlineNotice>
        {onDone && (
          <AppButton variant="secondary" onPress={onDone}>
            {t('common.done')}
          </AppButton>
        )}
      </div>
    );
  }
  if (state === 'failed') {
    return (
      <InlineNotice tone="danger" title={t(copy.failedTitle, { amount })}>
        {t(copy.failedBody)}
      </InlineNotice>
    );
  }
  const approveLink = approveUrl && (
    <ButtonLink href={approveUrl} external fullWidth>
      {t('transfer.approve')}
      <Icon icon={ExternalLink} size={16} />
      <span className="sr-only"> {t('a11y.opensInNewTab')}</span>
    </ButtonLink>
  );
  if (state === 'timedOut') {
    return (
      <div className="flex flex-col gap-3">
        <InlineNotice tone="warning" title={t('transfer.timedOutTitle')}>
          {t('transfer.timedOutBody', { amount })}
        </InlineNotice>
        {approveLink}
        <AppButton
          variant="secondary"
          fullWidth
          onPress={onCheckAgain}
          isPending={isRefreshing}
          pendingLabel={t('transfer.checking')}
        >
          {t('transfer.checkAgain')}
        </AppButton>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <InlineNotice tone="warning" title={t(copy.waitingTitle, { amount })}>
        {t(copy.waitingBody)}
      </InlineNotice>
      {approveLink}
      <PendingIndicator label={t('transfer.waiting')} />
    </div>
  );
}
