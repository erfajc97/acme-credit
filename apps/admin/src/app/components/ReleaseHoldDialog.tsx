import { ConfirmDialog } from '@acme/ui';
import type { ReleaseHoldView } from '@/app/hooks/useReleaseHold';
import { t } from '@/app/i18n';

/** The confirmation of "Release hold": it names the amount, the merchant and the customer. */
export function ReleaseHoldDialog({ release }: { release: ReleaseHoldView }) {
  if (!release.dialog) return null;
  return (
    <ConfirmDialog
      isOpen
      onOpenChange={release.onOpenChange}
      title={release.dialog.title}
      tone="danger"
      confirmLabel={t('releaseHold.action')}
      cancelLabel={t('common.cancel')}
      pendingLabel={t('releaseHold.pending')}
      onConfirm={release.confirm}
      isPending={release.isPending}
    >
      <p className="text-body">{release.dialog.body}</p>
      <p className="text-small text-muted">{t('releaseHold.note')}</p>
    </ConfirmDialog>
  );
}
