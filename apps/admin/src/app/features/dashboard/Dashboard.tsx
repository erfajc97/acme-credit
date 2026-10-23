import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { DashboardScreen } from './components/DashboardScreen';

// No services/: the figures and the side lists come from the shared queries (tanstack-queries).
/** The dashboard island (/dashboard): private, client-only behind the session gate (WA11). */
export default function Dashboard({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate
        fallback={() => <PageSkeleton label={t('dashboard.loading')} variant="dashboard" />}
      >
        <DashboardScreen />
      </AuthGate>
    </AppProviders>
  );
}
