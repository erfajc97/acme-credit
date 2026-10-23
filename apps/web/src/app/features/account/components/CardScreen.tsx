import type { Account } from '@acme/contracts';
import {
  AppButton,
  AppModal,
  ConfirmDialog,
  InlineNotice,
  PaymentCard,
  StatusChip,
  ToggleSwitch,
} from '@acme/ui';
import { ArrowRight } from 'lucide-react';
import { Icon } from '@/app/components/UI/Icon';
import { t } from '@/app/i18n';
import { useCardSettings } from '../hooks/useCardSettings';
import { CardDetails } from './CardDetails';
import { DepositPanel } from './DepositPanel';

interface CardScreenProps {
  account: Account;
}

/**
 * The card page: the card as printed on its stage, with its details, on the left; its settings
 * (freeze, raise the limit, close the account from the profile) on the right. One column on phones.
 */
export function CardScreen({ account }: CardScreenProps) {
  const page = useCardSettings(account);
  const card = page.card;
  return (
    <div className="grid gap-[clamp(0.75rem,2.4dvh,1.75rem)] lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-[clamp(0.75rem,2.4dvh,1.75rem)] lg:min-h-0">
        {card && (
          <div className="flex items-center justify-center rounded-card bg-lavender px-4 py-[clamp(1.25rem,4dvh,3rem)] sm:px-8 lg:flex-1">
            <div className="flex w-full max-w-md justify-center">
              <PaymentCard
                size="large"
                brandName={t('app.name')}
                last4={card.last4}
                numberLabel={t('account.card.numberLabel', { last4: card.last4 })}
                expiryLabel={t('account.card.expires')}
                expiry={card.expiresMonth}
                holderName={page.holderName}
                securedLabel={t('card.secured')}
                isFrozen={page.isFrozen}
                badge={
                  page.isFrozen ? (
                    <StatusChip tone="warning" label={t('status.frozen')} />
                  ) : undefined
                }
              />
            </div>
          </div>
        )}
        {card && (
          <CardDetails
            holderName={page.holderName}
            last4={card.last4}
            expiry={card.expiresMonth}
            status={page.status}
          />
        )}
      </div>

      <section
        data-tour="card-settings"
        aria-labelledby="card-settings-title"
        className="flex min-w-0 scroll-mt-24 flex-col gap-[clamp(1rem,2.6dvh,1.75rem)] rounded-card border-[1.6px] border-ink bg-surface-raised p-4 shadow-raised sm:p-[clamp(1rem,3.2dvh,2.5rem)] lg:self-start"
      >
        <h2 id="card-settings-title" className="font-display text-h3 font-bold">
          {t('card.settingsTitle')}
        </h2>
        <div className="flex flex-col gap-3">
          {page.freezeSwitch.isShown && (
            <ToggleSwitch
              label={t('card.freeze.label')}
              description={t('card.freeze.description')}
              isSelected={page.freezeSwitch.isSelected}
              onChange={page.freezeSwitch.onChange}
              isDisabled={page.freezeSwitch.isDisabled}
            />
          )}
          {page.isFrozenByAdmin && (
            <InlineNotice tone="warning" title={t('card.adminFrozen.title')}>
              {t('card.adminFrozen.body')}
            </InlineNotice>
          )}
          {page.isFrozen && !page.isFrozenByAdmin && (
            <InlineNotice tone="warning" title={t('account.frozenTitle')}>
              {t('account.frozenNotice')}
            </InlineNotice>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 border-t border-border pt-5">
          <h3 className="font-display text-body font-bold">{t('card.limit.title')}</h3>
          <p className="max-w-prose text-small text-muted">
            {t('card.limit.body', { limit: page.limit })}
          </p>
          <AppButton variant="secondary" onPress={page.depositDialog.onOpen}>
            {t('account.actions.deposit')}
          </AppButton>
        </div>
        <div className="flex flex-col items-start gap-1 border-t border-border pt-5">
          <h3 className="font-display text-body font-bold">{t('card.close.title')}</h3>
          <p className="max-w-prose text-small text-muted">{t('card.close.body')}</p>
          <a
            href={page.hrefs.profile}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-small font-semibold text-violet underline underline-offset-4"
          >
            {t('card.close.link')}
            <Icon icon={ArrowRight} size={16} />
          </a>
        </div>
      </section>

      <ConfirmDialog
        isOpen={page.confirm.isOpen}
        onOpenChange={page.confirm.onOpenChange}
        title={page.confirm.title}
        confirmLabel={page.confirm.confirmLabel}
        cancelLabel={t('card.freeze.cancel')}
        pendingLabel={t('account.actions.updating')}
        onConfirm={page.confirm.onConfirm}
        isPending={page.confirm.isPending}
      >
        <p className="text-body">{page.confirm.body}</p>
      </ConfirmDialog>

      <AppModal
        isOpen={page.depositDialog.isOpen}
        onOpenChange={page.depositDialog.onOpenChange}
        title={t('deposit.addTitle')}
      >
        <p className="text-small text-muted">{t('deposit.addIntro')}</p>
        <DepositPanel
          accountId={account.id}
          collateralCents={account.collateralCents}
          submitLabel={t('deposit.addSubmit')}
          onDone={page.depositDialog.onClose}
        />
      </AppModal>
    </div>
  );
}
