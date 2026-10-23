import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { AccountScreen } from './components/AccountScreen';
import type { AccountScreenKind } from './types';

interface AccountProps extends Pick<IslandProps, 'locale'> {
  /** "home" = the wallet (/app, usage only); "card" = the card and its settings (/app/card). */
  screen?: AccountScreenKind;
}

/**
 * The account island: private, client-only behind the session gate (WA11). One feature root for
 * both account pages, because the card page reuses the account's own flows (freeze, deposit).
 */
export default function Account({ locale, screen = 'home' }: AccountProps) {
  // Read at render time inside the providers: the island sets the page locale first.
  const loadingKey = screen === 'card' ? 'card.loading' : 'account.loading';
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t(loadingKey)} />}>
        <AccountScreen screen={screen} />
      </AuthGate>
    </AppProviders>
  );
}
