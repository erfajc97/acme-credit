import { AmountText, ButtonLink, InlineNotice, StatusChip } from '@acme/ui';
import { t } from '@/app/i18n';
import type { CheckoutOutcome } from '../types';

interface CheckoutResultProps {
  outcome: CheckoutOutcome;
  availableNow: string;
  declineNextHref: string;
  hrefs: { store: string; activity: string };
}

/**
 * Focus moves to the result's heading when it appears (the Pay button it replaces is gone), so
 * screen readers read the outcome and keyboard users continue from it. Stable: runs on mount only.
 */
const focusOnMount = (heading: HTMLHeadingElement | null) => heading?.focus();

/** The network's answer in the page: a receipt when approved, the reason and next step when declined. */
export function CheckoutResult({
  outcome,
  availableNow,
  declineNextHref,
  hrefs,
}: CheckoutResultProps) {
  if (outcome.kind === 'declined') {
    return (
      <div className="flex max-w-2xl flex-col gap-5">
        <h2 ref={focusOnMount} tabIndex={-1} className="sr-only">
          {t(outcome.titleKey, outcome.params)}
        </h2>
        <InlineNotice tone="danger" title={t(outcome.titleKey, outcome.params)}>
          <p>{t(outcome.bodyKey, outcome.params)}</p>
          <p className="mt-1 text-muted">{t('checkout.result.nothingCharged')}</p>
        </InlineNotice>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={declineNextHref}>{t(outcome.next.labelKey)}</ButtonLink>
          {declineNextHref !== hrefs.store && (
            <ButtonLink href={hrefs.store} variant="secondary">
              {t('checkout.result.editCart')}
            </ButtonLink>
          )}
        </div>
      </div>
    );
  }
  return (
    <section
      aria-labelledby="receipt-title"
      className="flex max-w-2xl flex-col gap-5 rounded-card border-[1.6px] border-ink bg-surface-raised p-5 shadow-raised md:p-6"
    >
      <div className="flex flex-col gap-2">
        <StatusChip tone="success" label={t('checkout.result.receipt')} />
        <h2
          id="receipt-title"
          ref={focusOnMount}
          tabIndex={-1}
          className="rounded-field font-display text-h2 font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet md:text-h2-lg"
        >
          {t(outcome.titleKey, outcome.params)}
        </h2>
      </div>
      <ul className="flex flex-col">
        {outcome.lines.map((line) => (
          <li
            key={line.sku}
            className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{line.name}</span>
              <span className="font-mono text-small text-muted tabular-nums">
                {t('checkout.lineQuantity', { quantity: line.quantity, unit: line.unit })}
              </span>
            </div>
            <AmountText value={line.total} />
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2 border-t-[1.6px] border-ink pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-display text-body font-bold">{t('checkout.total')}</dt>
          <dd className="text-h3 font-medium">
            <AmountText value={outcome.total} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 text-small">
          <dt className="text-muted">{t('checkout.result.newAvailable')}</dt>
          <dd>
            <AmountText value={availableNow} />
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-1 rounded-field bg-cream p-4">
        <span className="flex items-center gap-2 font-semibold text-warning">
          <StatusChip tone="warning" label={t('status.onHold')} />
          {t('checkout.result.onHold')}
        </span>
        <p className="text-small text-fg">{t('checkout.result.onHoldBody')}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={hrefs.store}>{t('checkout.result.keepShopping')}</ButtonLink>
        <ButtonLink href={hrefs.activity} variant="secondary">
          {t('checkout.result.seeActivity')}
        </ButtonLink>
      </div>
    </section>
  );
}
