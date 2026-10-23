import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { StoreScreen } from './components/StoreScreen';

// No services/ or mutations/: the catalog is the shared contract, the cart a shared store
// (src/app/store/cartStore.ts) and the payment happens in the checkout feature.
/** The in-wallet store island (/app/store): private, client-only behind the session gate (WA11). */
export default function Store({ locale }: Pick<IslandProps, 'locale'>) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('store.loading')} />}>
        <StoreScreen />
      </AuthGate>
    </AppProviders>
  );
}
