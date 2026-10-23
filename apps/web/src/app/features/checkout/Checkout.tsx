import { AuthGate } from '@/app/components/AuthGate';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { CheckoutScreen } from './components/CheckoutScreen';

/** The checkout island (/app/checkout): private, client-only behind the session gate (WA11). */
export default function Checkout({ locale }: Pick<IslandProps, 'locale'>) {
  return (
    <AppProviders locale={locale} withToaster>
      <AuthGate fallback={() => <PageSkeleton label={t('checkout.loading')} />}>
        <CheckoutScreen />
      </AuthGate>
    </AppProviders>
  );
}
