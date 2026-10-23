import { ButtonLink, EmptyState, ErrorState } from '@acme/ui';
import { ShoppingBag } from 'lucide-react';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { Icon } from '@/app/components/UI/Icon';
import { t } from '@/app/i18n';
import { useCheckoutPage } from '../hooks/useCheckoutPage';
import { CheckoutResult } from './CheckoutResult';
import { OrderReview } from './OrderReview';
import { PaymentSummary } from './PaymentSummary';

/** Review → pay → result, under an intro that says which of the two the customer is looking at. */
export function CheckoutScreen() {
  const page = useCheckoutPage();
  const hasResult = page.view === 'result' && page.outcome !== null;
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-body text-muted">
        {t(hasResult ? 'checkout.resultIntro' : 'checkout.pageIntro')}
      </p>
      {checkoutBody(page)}
    </div>
  );
}

/** The body for the page's state. Two columns from lg (lines | sticky payment), one on phones. */
function checkoutBody(page: ReturnType<typeof useCheckoutPage>) {
  if (page.view === 'loading') return <PageSkeleton label={t('checkout.loading')} />;
  if (page.view === 'error') {
    return (
      <ErrorState
        title={t('account.loadFailedTitle')}
        body={t('account.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={page.retry}
        isRetrying={page.isRetrying}
      />
    );
  }
  if (page.view === 'result' && page.outcome) {
    return (
      <CheckoutResult
        outcome={page.outcome}
        availableNow={page.availableNow}
        declineNextHref={page.declineNextHref}
        hrefs={page.hrefs}
      />
    );
  }
  if (page.view === 'noCard' || !page.card) {
    return (
      <EmptyState
        title={t('checkout.noCardTitle')}
        body={t('checkout.noCardBody')}
        action={<ButtonLink href={page.hrefs.wallet}>{t('common.backToAccount')}</ButtonLink>}
      />
    );
  }
  if (page.view === 'empty') {
    return (
      <EmptyState
        icon={<Icon icon={ShoppingBag} size={24} />}
        title={t('checkout.emptyTitle')}
        body={t('checkout.emptyBody')}
        action={<ButtonLink href={page.hrefs.store}>{t('checkout.backToStore')}</ButtonLink>}
      />
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
      <OrderReview
        merchantName={page.merchantName}
        items={page.items}
        lines={page.lines}
        editHref={page.hrefs.store}
      />
      <div className="lg:sticky lg:top-6">
        <PaymentSummary
          card={page.card}
          total={page.total}
          available={page.available}
          left={page.left}
          isOverAvailable={page.isOverAvailable}
          onPay={page.pay}
          isPaying={page.isPaying}
        />
      </div>
    </div>
  );
}
