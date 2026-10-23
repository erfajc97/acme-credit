/** Splits a formatted amount ("$1,234.56") into its whole part and its cents (".56"). */
export function splitAmount(formatted: string): { whole: string; cents: string } {
  const match = /^(.*?)([.,]\d{2})$/.exec(formatted);
  return match ? { whole: match[1] ?? '', cents: match[2] ?? '' } : { whole: formatted, cents: '' };
}

export interface AmountTextProps {
  /** An amount already formatted from integer cents (never a float), e.g. "$1,234.56". */
  value: string;
  /** "hero" is the available-to-spend figure; "inherit" takes the size of its context. */
  size?: 'inherit' | 'hero';
}

/**
 * The signature "ledger" figure (docs/brand.md › Amounts): mono, tabular, cents at 0.75 em in
 * muted next to the dollars. The text content stays the whole amount for screen readers.
 */
export function AmountText({ value, size = 'inherit' }: AmountTextProps) {
  const { whole, cents } = splitAmount(value);
  const sizeClass = size === 'hero' ? 'text-balance font-medium md:text-balance-lg' : '';
  return (
    <span className={`font-mono whitespace-nowrap tabular-nums ${sizeClass}`}>
      {whole}
      {cents && <span className="text-[75%] text-muted">{cents}</span>}
    </span>
  );
}
