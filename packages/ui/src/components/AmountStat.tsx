import { AmountText } from './AmountText';

export interface AmountStatProps {
  label: string;
  /** Formatted amount. */
  value: string;
  hint?: string | undefined;
  size?: 'inherit' | 'hero';
}

/** A labeled amount; render it inside a `<dl>` (it is a dt/dd group). */
export function AmountStat({ label, value, hint, size = 'inherit' }: AmountStatProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="flex flex-col gap-0.5">
        <AmountText value={value} size={size} />
        {hint && <span className="text-caption text-muted">{hint}</span>}
      </dd>
    </div>
  );
}
