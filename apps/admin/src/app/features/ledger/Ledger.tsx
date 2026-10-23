import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { LedgerScreen } from './components/LedgerScreen';

// No services/ or types.ts: entries and the trial balance come from the shared queries.
/** The global ledger island (/ledger): private, client-only behind the session gate (WA11). */
export default function Ledger({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('ledger.loading')} />}>
        <LedgerScreen />
      </AuthGate>
    </AppProviders>
  );
}
