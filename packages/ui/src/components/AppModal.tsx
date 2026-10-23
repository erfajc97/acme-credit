import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

export interface AppModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** A pending money action must not be dismissed by a stray tap outside. */
  isDismissable?: boolean;
}

/**
 * Controlled dialog. HeroUI v3's `<Modal>` root is a trigger and warns without a pressable
 * child, so a dialog opened from state controls `Modal.Backdrop` directly (WA8).
 */
export function AppModal({
  isOpen,
  onOpenChange,
  title,
  children,
  footer,
  isDismissable = true,
}: AppModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={isDismissable}>
      <Modal.Container placement="center" size="md" scroll="inside">
        <Modal.Dialog className="rounded-card border-[1.6px] border-ink bg-surface-raised text-fg shadow-overlay">
          <Modal.Header>
            <Modal.Heading className="font-display text-h3 font-bold">{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
          {footer && (
            <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {footer}
            </Modal.Footer>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
