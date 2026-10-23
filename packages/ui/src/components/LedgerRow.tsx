import type { MouseEvent, ReactNode } from 'react';
import { AmountText } from './AmountText';

export interface LedgerRowProps {
  primary: string;
  secondary?: string | undefined;
  /** Formatted amount. */
  amount: string;
  status?: ReactNode;
  action?: ReactNode;
  /** The row opens something (e.g. an order's detail): its text and amount become one link. */
  link?: { href: string; onClick?: (event: MouseEvent) => void } | undefined;
}

/**
 * One row of a ledger list: hairline rules between rows, never zebra stripes (docs/brand.md).
 * It is a list item, so the same markup reads as a card on phones and as a row on desktop.
 */
export function LedgerRow({ primary, secondary, amount, status, action, link }: LedgerRowProps) {
  const content = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{primary}</span>
        {secondary && <span className="text-small text-muted">{secondary}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <AmountText value={amount} />
        {status}
      </span>
    </>
  );
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      {link ? (
        <a
          href={link.href}
          onClick={link.onClick}
          className="-mx-2 -my-1.5 flex min-h-11 items-start justify-between gap-4 rounded-field px-2 py-1.5 text-fg transition-colors duration-fast ease-out hover:bg-neutral-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet"
        >
          {content}
        </a>
      ) : (
        <div className="flex items-start justify-between gap-4">{content}</div>
      )}
      {action && <div className="flex justify-end">{action}</div>}
    </li>
  );
}
