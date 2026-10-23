import { ConfirmDialog } from '@acme/ui';
import { t } from '@/app/i18n';

interface SwitchCartDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  current: string;
  next: string;
  items: string;
  onConfirm: () => void;
}

/** One order = one merchant: adding from another merchant asks before emptying the cart. */
export function SwitchCartDialog({
  isOpen,
  onOpenChange,
  current,
  next,
  items,
  onConfirm,
}: SwitchCartDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('store.switch.title')}
      confirmLabel={t('store.switch.confirm')}
      cancelLabel={t('store.switch.cancel')}
      pendingLabel={t('store.switch.confirm')}
      onConfirm={onConfirm}
    >
      <p className="text-body">{t('store.switch.body', { current, next, items })}</p>
    </ConfirmDialog>
  );
}
