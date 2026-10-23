import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { ProfileScreen } from './components/ProfileScreen';

/** The profile island (/app/profile): private, client-only behind the session gate (WA11). */
export default function Profile({ locale }: Pick<IslandProps, 'locale'>) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('profile.loading')} />}>
        <ProfileScreen />
      </AuthGate>
    </AppProviders>
  );
}
