import { AppButton } from '@acme/ui';
import { t } from '@/app/i18n';
import { useSessionMenu } from '../hooks/useSessionMenu';

export default function SessionMenu() {
  const menu = useSessionMenu();
  // Same footprint before the session is known, so the shell does not shift.
  if (!menu.isVisible) return <div className="h-11 w-24" aria-hidden="true" />;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex min-w-0 flex-col text-small">
        <span className="truncate font-semibold">{menu.userName}</span>
        <span className="truncate text-caption text-muted">
          {t('session.role')} · {menu.userEmail}
        </span>
      </p>
      <div className="flex flex-col items-stretch gap-2">
        <AppButton variant="ghost" size="compact" onPress={menu.startTour}>
          {t('session.tour')}
        </AppButton>
        <AppButton
          variant="secondary"
          size="compact"
          onPress={menu.signOut}
          isPending={menu.isPending}
          pendingLabel={t('session.signingOut')}
        >
          {t('session.signOut')}
        </AppButton>
      </div>
    </div>
  );
}
