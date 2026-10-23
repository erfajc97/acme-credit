import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { PurchasesScreen } from './components/PurchasesScreen';

// No services/, helpers/ or types.ts: the list is the shared query (tanstack-queries/adminQueries)
// and its rows come from the shared purchase helper (helpers/orders), also used by the dashboard.
/** The purchases island (/purchases): private, client-only behind the session gate (WA11). */
export default function Purchases({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('purchases.loading')} />}>
        <PurchasesScreen />
      </AuthGate>
    </AppProviders>
  );
}
