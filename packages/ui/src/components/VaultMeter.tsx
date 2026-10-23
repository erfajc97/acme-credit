import { AmountText } from './AmountText';

export type VaultSegmentTone = 'owed' | 'held' | 'available';

export interface VaultSegment {
  id: string;
  label: string;
  /** Formatted amount, e.g. "$120.00". */
  amount: string;
  /** Share of the credit limit, 0–100 (display only: the amounts are the source of truth). */
  percent: number;
  tone: VaultSegmentTone;
}

export interface VaultMeterProps {
  /** Accessible name of the whole meter. */
  label: string;
  collateral: { label: string; amount: string };
  segments: VaultSegment[];
}

const SEGMENT_CLASS: Record<VaultSegmentTone, string> = {
  owed: 'bg-fg',
  held: 'bg-warning',
  available: 'bg-brand-500',
};

/**
 * The vault meter: the security deposit (violet "secured" marker) that backs the whole limit, and
 * the limit split into owed · on hold · available in an ink-outlined bar. Never a gauge or a score;
 * every segment is named with its amount in the legend, so color is never the only signal.
 */
export function VaultMeter({ label, collateral, segments }: VaultMeterProps) {
  return (
    <figure aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-small">
        <span className="flex items-center gap-2 font-medium text-violet">
          <span aria-hidden="true" className="size-2.5 bg-violet" />
          {collateral.label}
        </span>
        <AmountText value={collateral.amount} />
      </div>
      <div
        aria-hidden="true"
        className="flex h-4 w-full overflow-hidden rounded-control border-[1.6px] border-ink bg-neutral-soft"
      >
        {segments.map((segment) => (
          <div
            key={segment.id}
            data-segment={segment.id}
            className={`h-full ${SEGMENT_CLASS[segment.tone]}`}
            style={{ width: `${segment.percent}%` }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,5rem),1fr))] gap-2 text-small">
        {segments.map((segment) => (
          <div key={segment.id} className="flex min-w-0 flex-col items-start gap-0.5">
            <dt className="flex items-center gap-2 text-muted">
              <span
                aria-hidden="true"
                className={`size-2.5 rounded-full border border-ink ${SEGMENT_CLASS[segment.tone]}`}
              />
              {segment.label}
            </dt>
            <dd>
              <AmountText value={segment.amount} />
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
