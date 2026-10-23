import type { Account } from '@acme/contracts';
import { AppModal } from '@acme/ui';
import { t } from '@/app/i18n';
import { useAccountOverview } from '../hooks/useAccountOverview';
import { AvailableHero } from './AvailableHero';
import { CardSummary } from './CardSummary';
import { DepositPanel } from './DepositPanel';
import { LimitUsage } from './LimitUsage';
import { PaymentPanel } from './PaymentPanel';
import { RecentOrders } from './RecentOrders';

interface AccountOverviewProps {
  account: Account;
}

/**
 * The wallet home: usage only. Phones read top to bottom — card strip, available to spend with
 * the actions, the limit and its meter, recent orders. From lg it fits one screen: available and
 * the limit on the left (the available figure takes the spare height); the card strip and the
 * recent orders (scrolling inside) on the right.
 */
export function AccountOverview({ account }: AccountOverviewProps) {
  const overview = useAccountOverview(account);
  return (
    <div className="flex flex-col gap-[clamp(0.75rem,2.4dvh,1.75rem)] lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr_auto]">
      {overview.card && (
        <div className="lg:col-start-2 lg:row-start-1">
          <CardSummary
            last4={overview.card.last4}
            expiry={overview.card.expiresMonth}
            isFrozen={overview.isFrozen}
            status={overview.cardStatus}
            href={overview.hrefs.card}
          />
        </div>
      )}
      <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:min-h-0">
        <AvailableHero
          greeting={overview.greeting}
          available={overview.balances.available}
          storeHref={overview.hrefs.store}
          onPayment={overview.paymentDialog.onOpen}
          onDeposit={overview.depositDialog.onOpen}
        />
      </div>
      <div className="lg:col-start-1 lg:row-start-3">
        <LimitUsage
          limit={overview.balances.limit}
          collateral={overview.balances.collateral}
          segments={overview.segments}
        />
      </div>
      <div className="flex min-h-0 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-2">
        <RecentOrders
          rows={overview.recent.rows}
          isLoading={overview.recent.isLoading}
          isError={overview.recent.isError}
          onRetry={overview.recent.retry}
          isRetrying={overview.recent.isRetrying}
          activityHref={overview.hrefs.activity}
        />
      </div>

      <AppModal
        isOpen={overview.paymentDialog.isOpen}
        onOpenChange={overview.paymentDialog.onOpenChange}
        title={t('payment.title')}
      >
        <p className="text-small text-muted">{t('payment.intro')}</p>
        <PaymentPanel
          accountId={account.id}
          postedDebtCents={account.postedDebtCents}
          onDone={overview.paymentDialog.onClose}
        />
      </AppModal>

      <AppModal
        isOpen={overview.depositDialog.isOpen}
        onOpenChange={overview.depositDialog.onOpenChange}
        title={t('deposit.addTitle')}
      >
        <p className="text-small text-muted">{t('deposit.addIntro')}</p>
        <DepositPanel
          accountId={account.id}
          collateralCents={account.collateralCents}
          submitLabel={t('deposit.addSubmit')}
          onDone={overview.depositDialog.onClose}
        />
      </AppModal>
    </div>
  );
}
