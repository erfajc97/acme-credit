import { AmountText } from '@acme/ui';
import { t } from '@/app/i18n';
import type { OrderLineView } from '../types';

interface OrderReviewProps {
  merchantName: string;
  items: string;
  lines: OrderLineView[];
  editHref: string;
}

/** The lines of the order as the customer will pay them: name, quantity × unit price, line total. */
export function OrderReview({ merchantName, items, lines, editHref }: OrderReviewProps) {
  return (
    <section
      aria-labelledby="order-title"
      className="flex min-w-0 flex-col gap-4 rounded-card border-[1.6px] border-ink bg-surface-raised p-5 shadow-raised md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="order-title" className="font-display text-h3 font-bold md:text-h3-lg">
            {t('checkout.linesTitle')}
          </h2>
          <p className="text-small font-semibold text-violet">
            {merchantName} · {items}
          </p>
        </div>
        <a
          href={editHref}
          className="inline-flex min-h-11 items-center font-semibold text-violet underline underline-offset-4"
        >
          {t('checkout.editCart')}
        </a>
      </div>
      <ul className="flex flex-col">
        {lines.map((line) => (
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
    </section>
  );
}
