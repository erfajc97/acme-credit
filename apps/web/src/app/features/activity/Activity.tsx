import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { ActivityScreen } from './components/ActivityScreen';

// No types.ts: rows are typed in their hooks; the reads are shared queries (tanstack-queries/).
/** The activity island (/app/activity): orders and movements, private and client-only (WA11). */
export default function Activity({ locale }: Pick<IslandProps, 'locale'>) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('activity.loading')} />}>
        <ActivityScreen />
      </AuthGate>
    </AppProviders>
  );
}
