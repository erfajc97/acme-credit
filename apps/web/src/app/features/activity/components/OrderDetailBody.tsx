import { AmountText, StatusChip } from '@acme/ui';
import type { OrderDetail } from '@/app/helpers/orders';
import { t } from '@/app/i18n';

/** A loaded order: merchant, date and status, every line with quantity × unit price, total, what happened. */
export function OrderDetailBody({
  detail,
  showTimeline,
}: {
  detail: OrderDetail;
  showTimeline: boolean;
}) {
  return (
    <>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-small">
        <dt className="text-muted">{t('activity.detail.merchant')}</dt>
        <dd className="font-semibold text-fg">{detail.merchant}</dd>
        <dt className="text-muted">{t('activity.detail.date')}</dt>
        <dd className="text-fg">{detail.when}</dd>
        <dt className="text-muted">{t('activity.detail.status')}</dt>
        <dd>
          <StatusChip tone={detail.tone} label={t(detail.statusKey)} />
        </dd>
        {detail.holdExpiry && (
          <>
            <dt className="text-muted">{t('activity.detail.holdExpiry')}</dt>
            <dd className="text-fg">{detail.holdExpiry}</dd>
          </>
        )}
      </dl>
      <section aria-labelledby="order-items" className="flex flex-col gap-2">
        <h3 id="order-items" className="font-display text-body font-bold">
          {t('activity.detail.items')}
        </h3>
        {detail.lines.length > 0 ? (
          <ul className="flex flex-col rounded-field border-[1.6px] border-border">
            {detail.lines.map((line) => (
              <li
                key={line.sku}
                className="flex items-start justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-fg">{line.name}</span>
                  <span className="font-mono text-small text-muted tabular-nums">
                    {line.quantityLabel}
                  </span>
                </span>
                <AmountText value={line.total} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-muted">{t('activity.detail.noItems')}</p>
        )}
        <p className="flex items-baseline justify-between gap-4 border-t-[1.6px] border-ink pt-3">
          <span className="font-display font-bold">{t('activity.detail.total')}</span>
          <span className="text-h3 font-medium">
            <AmountText value={detail.amount} />
          </span>
        </p>
      </section>
      <section
        aria-labelledby="order-outcome"
        className="flex flex-col gap-1 rounded-field bg-cream p-3"
      >
        <h3 id="order-outcome" className="font-display text-body font-bold">
          {t('activity.detail.whatHappened')}
        </h3>
        <p className="text-small text-fg">{detail.outcome}</p>
      </section>
      {showTimeline && (
        <section aria-labelledby="order-timeline" className="flex flex-col gap-2">
          <h3 id="order-timeline" className="font-display text-body font-bold">
            {t('activity.detail.timelineTitle')}
          </h3>
          <ol className="flex flex-col gap-2 border-l-[1.6px] border-ink pl-4">
            {detail.timeline.map((step) => (
              <li key={step.labelKey} className="flex flex-col">
                <span className="text-small font-semibold text-fg">{t(step.labelKey)}</span>
                <span className="text-caption text-muted">{step.when}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
