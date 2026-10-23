import { AmountText, AppButton, InlineNotice, PaymentCard, StatusChip } from '@acme/ui';
import { t } from '@/app/i18n';

interface PaymentSummaryProps {
  card: { last4: string; expiry: string; isFrozen: boolean };
  total: string;
  available: string;
  left: string | null;
  isOverAvailable: boolean;
  onPay: () => void;
  isPaying: boolean;
}

/**
 * The card, "available to spend" against the total, and the one yellow action. Over the limit it
 * warns in words with both amounts but still lets the customer pay: the network decides.
 */
export function PaymentSummary({
  card,
  total,
  available,
  left,
  isOverAvailable,
  onPay,
  isPaying,
}: PaymentSummaryProps) {
  return (
    <section
      aria-labelledby="payment-title"
      className="flex flex-col gap-5 rounded-card border-[1.6px] border-ink bg-surface-raised p-5 shadow-raised md:p-6"
    >
      <h2 id="payment-title" className="font-display text-h3 font-bold md:text-h3-lg">
        {t('checkout.summaryTitle')}
      </h2>
      <div className="flex flex-col gap-2">
        <span className="text-small text-muted">{t('checkout.payWith')}</span>
        <PaymentCard
          size="compact"
          brandName={t('app.name')}
          last4={card.last4}
          numberLabel={t('account.card.numberLabel', { last4: card.last4 })}
          expiryLabel={t('account.card.expires')}
          expiry={card.expiry}
          isFrozen={card.isFrozen}
          badge={
            card.isFrozen ? <StatusChip tone="warning" label={t('status.frozen')} /> : undefined
          }
        />
      </div>
      <dl className="flex flex-col text-small">
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-muted">{t('checkout.available')}</dt>
          <dd>
            <AmountText value={available} />
          </dd>
        </div>
        {left && (
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-muted">{t('checkout.leftAfter')}</dt>
            <dd>
              <AmountText value={left} />
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 border-t-[1.6px] border-ink pt-3">
          <dt className="font-display text-body font-bold">{t('checkout.total')}</dt>
          <dd className="text-h3 font-medium">
            <AmountText value={total} />
          </dd>
        </div>
      </dl>
      {isOverAvailable && (
        <InlineNotice tone="warning" title={t('checkout.overLimitTitle')}>
          {t('checkout.overLimitBody', { total, available })}
        </InlineNotice>
      )}
      {card.isFrozen && (
        <InlineNotice tone="warning" title={t('account.frozenTitle')}>
          {t('checkout.frozenNotice')}
        </InlineNotice>
      )}
      <AppButton
        fullWidth
        onPress={onPay}
        isPending={isPaying}
        pendingLabel={t('checkout.confirming')}
      >
        {t('checkout.confirm', { total })}
      </AppButton>
    </section>
  );
}
