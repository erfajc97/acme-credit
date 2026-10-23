import type { ReactNode } from 'react';
import { AppButton } from './AppButton';
import { AppModal } from './AppModal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  tone?: 'primary' | 'danger';
}

/** The only confirmation in the apps (W5: never window.confirm). */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  onConfirm,
  isPending = false,
  tone = 'primary',
}: ConfirmDialogProps) {
  return (
    <AppModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      isDismissable={!isPending}
      footer={
        <>
          <AppButton variant="ghost" onPress={() => onOpenChange(false)} isDisabled={isPending}>
            {cancelLabel}
          </AppButton>
          <AppButton
            variant={tone}
            onPress={onConfirm}
            isPending={isPending}
            pendingLabel={pendingLabel}
          >
            {confirmLabel}
          </AppButton>
        </>
      }
    >
      {children}
    </AppModal>
  );
}
