import type { Account } from '@acme/contracts';
import { AmountText, ConfirmDialog, InlineNotice } from '@acme/ui';
import { t } from '@/app/i18n';
import { useCloseAccount } from '../hooks/useCloseAccount';

interface CloseAccountDialogProps {
  account: Account;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClosed: () => void;
}

/** Explains what closing does to the security deposit before the customer confirms. */
export function CloseAccountDialog({
  account,
  isOpen,
  onOpenChange,
  onClosed,
}: CloseAccountDialogProps) {
  const close = useCloseAccount(account, onClosed);
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('close.title')}
      tone="danger"
      confirmLabel={t('close.confirm')}
      cancelLabel={t('close.cancel')}
      pendingLabel={t('close.closing')}
      onConfirm={close.confirm}
      isPending={close.isPending}
    >
      <p className="text-body">{t(close.bodyKey, close.amounts)}</p>
      <dl className="flex flex-col divide-y divide-border">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">{t('close.depositLabel')}</dt>
          <dd>
            <AmountText value={close.amounts.collateral} />
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">{t('close.appliedLabel')}</dt>
          <dd>
            <AmountText value={close.amounts.applied} />
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-2 font-medium">
          <dt>{t('close.returnedLabel')}</dt>
          <dd>
            <AmountText value={close.amounts.returned} />
          </dd>
        </div>
      </dl>
      {close.hasHolds && (
        <InlineNotice tone="warning" title={t('close.holdsTitle', { amount: close.amounts.held })}>
          {t('close.holdsBody')}
        </InlineNotice>
      )}
    </ConfirmDialog>
  );
}
