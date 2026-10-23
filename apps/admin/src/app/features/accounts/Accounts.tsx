import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { AccountsScreen } from './components/AccountsScreen';

// No services/ or types.ts: the list comes from the shared query (tanstack-queries/adminQueries).
/** The accounts list island (/accounts): private, client-only behind the session gate (WA11). */
export default function Accounts({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('accounts.loading')} />}>
        <AccountsScreen />
      </AuthGate>
    </AppProviders>
  );
}
