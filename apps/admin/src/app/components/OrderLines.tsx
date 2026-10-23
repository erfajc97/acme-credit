import { AmountText } from '@acme/ui';
import { ChevronDown } from 'lucide-react';
import type { OrderLineView } from '@/app/helpers/orders';
import { t } from '@/app/i18n';
import { Icon } from './UI/Icon';

interface OrderLinesProps {
  merchant: string;
  lines: OrderLineView[];
}

/**
 * The items of a store purchase, folded by default so the table stays dense: "2 × Café @ USD 3.50"
 * and the line's subtotal, amounts in mono. A plain card purchase has no items and says so.
 */
export function OrderLines({ merchant, lines }: OrderLinesProps) {
  if (lines.length === 0)
    return <span className="text-caption text-muted">{t('orders.noItems')}</span>;
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control text-small font-semibold text-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet lg:min-h-8 [&::-webkit-details-marker]:hidden">
        {t('orders.showItems', { count: lines.length })}
        <span className="transition-transform duration-fast ease-out group-open:rotate-180">
          <Icon icon={ChevronDown} size={16} />
        </span>
      </summary>
      <ul
        aria-label={t('orders.itemsCaption', { merchant })}
        className="mt-1 flex flex-col gap-1 rounded-field bg-neutral-soft p-3 text-small"
      >
        {lines.map((line) => (
          <li key={line.key} className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span>{t('orders.line', { quantity: line.quantity, name: line.name })}</span>
              <span className="text-caption text-muted">
                {t('orders.unit', { unit: line.unit })}
              </span>
            </span>
            <AmountText value={line.subtotal} />
          </li>
        ))}
      </ul>
    </details>
  );
}
