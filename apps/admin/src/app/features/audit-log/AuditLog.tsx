import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { AuditLogScreen } from './components/AuditLogScreen';

// No services/ or types.ts: the trail comes from the shared query (tanstack-queries/adminQueries).
/** The audit log island (/audit-log): private, client-only behind the session gate (WA11). */
export default function AuditLog({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('auditLog.loading')} />}>
        <AuditLogScreen />
      </AuthGate>
    </AppProviders>
  );
}
