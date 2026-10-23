import { AppButton, ButtonLink, ErrorState, Mascot, Skeleton } from '@acme/ui';
import { t } from '@/app/i18n';
import { useProfile } from '../hooks/useProfile';
import { CloseAccountDialog } from './CloseAccountDialog';

/** Who is signed in (with sign out) and the account section (close). Preferences are static. */
export function ProfileScreen() {
  const profile = useProfile();
  const { account } = profile;
  let accountBody;
  if (account.isLoading) accountBody = <Skeleton className="h-12 w-full rounded-field" />;
  else if (account.isError) {
    accountBody = (
      <ErrorState
        title={t('account.loadFailedTitle')}
        body={t('account.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={account.retry}
        isRetrying={account.isRetrying}
      />
    );
  } else if (account.closable) {
    accountBody = (
      <>
        <p className="max-w-prose text-small text-muted">{t('profile.closeBody')}</p>
        <div>
          <AppButton variant="danger" size="compact" onPress={profile.closeDialog.onOpen}>
            {t('profile.closeAction')}
          </AppButton>
        </div>
        <CloseAccountDialog
          account={account.closable}
          isOpen={profile.closeDialog.isOpen}
          onOpenChange={profile.closeDialog.onOpenChange}
          onClosed={profile.closeDialog.onClose}
        />
      </>
    );
  } else accountBody = <p className="text-small text-muted">{t('profile.noOpenAccount')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="who-title"
        className="flex flex-col gap-4 rounded-card border-[1.6px] border-ink bg-surface-raised p-5 shadow-raised sm:flex-row sm:items-center sm:justify-between md:p-6"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-[1.6px] border-ink bg-brand-500 font-display text-h3 font-bold text-on-brand"
          >
            {profile.name.charAt(0)}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-muted">{t('profile.signedInAs')}</span>
            <h2 id="who-title" className="truncate font-display text-h3 font-bold">
              {profile.name}
            </h2>
            <span className="truncate text-small text-muted">{profile.email}</span>
          </div>
        </div>
        <AppButton
          variant="secondary"
          onPress={profile.signOut}
          isPending={profile.isSigningOut}
          pendingLabel={t('session.signingOut')}
        >
          {t('session.signOut')}
        </AppButton>
      </section>
      <section
        aria-labelledby="tutorial-title"
        className="flex items-center gap-4 rounded-card border-[1.6px] border-ink bg-lavender p-5 md:p-6"
      >
        <Mascot pose="wave" size="sm" className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <h2 id="tutorial-title" className="font-display text-h3 font-bold">
            {t('profile.tutorialTitle')}
          </h2>
          <p className="max-w-prose text-small text-fg">{t('profile.tutorialBody')}</p>
          <ButtonLink href={profile.tourHref} variant="secondary">
            {t('profile.tutorialAction')}
          </ButtonLink>
        </div>
      </section>
      <section
        aria-labelledby="account-title"
        className="flex flex-col gap-3 rounded-card bg-neutral-soft p-5 md:p-6"
      >
        <h2 id="account-title" className="font-display text-h3 font-bold">
          {t('profile.accountTitle')}
        </h2>
        {accountBody}
      </section>
    </div>
  );
}
