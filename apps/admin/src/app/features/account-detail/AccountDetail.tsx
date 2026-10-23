import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { AccountDetailScreen } from './components/AccountDetailScreen';

// No types.ts: the account and its histories are contract types (@acme/contracts).
/** One account (/accounts/view?id=…): private, client-only behind the session gate (WA11). */
export default function AccountDetail({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate
        fallback={() => <PageSkeleton label={t('accountDetail.loading')} variant="detail" />}
      >
        <AccountDetailScreen />
      </AuthGate>
    </AppProviders>
  );
}
