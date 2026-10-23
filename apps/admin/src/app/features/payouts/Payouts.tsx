import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { PayoutsScreen } from './components/PayoutsScreen';

// No services/, helpers/ or types.ts: the list is the shared query (tanstack-queries/adminQueries)
// and its rows come from the shared payout helper (helpers/payouts), also used by the account page.
/** The payouts island (/payouts): private, client-only behind the session gate (WA11). */
export default function Payouts({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('payouts.loading')} />}>
        <PayoutsScreen />
      </AuthGate>
    </AppProviders>
  );
}
