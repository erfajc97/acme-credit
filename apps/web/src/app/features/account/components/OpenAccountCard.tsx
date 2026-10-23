import { AppButton, Panel } from '@acme/ui';
import { t } from '@/app/i18n';
import { useOpenAccount } from '../hooks/useOpenAccount';

/** No account yet: what the secured card is, and the one action that starts it. */
export function OpenAccountCard() {
  const onboarding = useOpenAccount();
  return (
    <Panel labelledBy="open-account-title">
      <h2 id="open-account-title" className="font-display text-h2 font-semibold md:text-h2-lg">
        {t('account.onboarding.title')}
      </h2>
      <p className="max-w-prose text-body text-muted">{t('account.onboarding.body')}</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-body">
        <li>{t('account.onboarding.step1')}</li>
        <li>{t('account.onboarding.step2')}</li>
        <li>{t('account.onboarding.step3')}</li>
      </ol>
      <AppButton
        fullWidth
        onPress={onboarding.open}
        isPending={onboarding.isPending}
        pendingLabel={t('account.onboarding.opening')}
      >
        {t('account.onboarding.open')}
      </AppButton>
    </Panel>
  );
}
