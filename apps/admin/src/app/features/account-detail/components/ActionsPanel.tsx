import type { AdminAccount } from '@acme/contracts';
import { AppButton, ChoiceGroup, ConfirmDialog, Panel } from '@acme/ui';
import { SectionTitle } from '@/app/components/SectionTitle';
import { t } from '@/app/i18n';
import { useAccountActions } from '../hooks/useAccountActions';

/**
 * Freeze (with its reason), unfreeze and close, each confirmed in a dialog that names the money
 * involved.
 */
export function ActionsPanel({ account }: { account: AdminAccount }) {
  const actions = useAccountActions(account);
  return (
    <Panel labelledBy="actions-title" density="compact">
      <SectionTitle id="actions-title">{t('accountDetail.actionsTitle')}</SectionTitle>
      {actions.isClosed ? (
        <p className="text-small text-muted">{t('accountDetail.actionsClosed')}</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions.buttons.map((button) => (
            <AppButton
              key={button.action}
              variant={button.action === 'unfreeze' ? 'primary' : 'secondary'}
              onPress={() => actions.open(button.action)}
              isDisabled={button.isDisabled}
            >
              {button.label}
            </AppButton>
          ))}
        </div>
      )}
      {actions.blockedReason && <p className="text-small text-muted">{actions.blockedReason}</p>}
      {actions.dialog && (
        <ConfirmDialog
          isOpen
          onOpenChange={actions.onOpenChange}
          title={actions.dialog.title}
          tone={actions.dialog.tone}
          confirmLabel={actions.dialog.confirmLabel}
          cancelLabel={t('common.cancel')}
          pendingLabel={actions.dialog.pendingLabel}
          onConfirm={actions.confirm}
          isPending={actions.isPending}
        >
          <p className="text-body">{actions.dialog.body}</p>
          {actions.dialog.asksReason && (
            <ChoiceGroup
              label={t('accountDetail.freeze.reasonLabel')}
              name="freeze-reason"
              options={actions.freezeReason.options}
              value={actions.freezeReason.value}
              onChange={actions.freezeReason.onChange}
            />
          )}
        </ConfirmDialog>
      )}
    </Panel>
  );
}
