export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

/** Tinted pill + a dot in the status color: never color alone, the word is always there. */
const TONE_CLASS: Record<StatusTone, { chip: string; dot: string }> = {
  neutral: { chip: 'bg-neutral-soft text-fg', dot: 'bg-muted' },
  success: { chip: 'bg-mint text-success', dot: 'bg-success' },
  warning: { chip: 'bg-cream text-warning border border-warning/40', dot: 'bg-warning' },
  danger: { chip: 'bg-surface-raised text-danger border border-danger', dot: 'bg-danger' },
  brand: { chip: 'bg-brand-500 text-on-brand', dot: 'bg-on-brand' },
};

export interface StatusChipProps {
  /** Always a word: color is never the only signal (docs/brand.md › Do / don't). */
  label: string;
  tone: StatusTone;
}

export function StatusChip({ label, tone }: StatusChipProps) {
  const style = TONE_CLASS[tone];
  return (
    <span
      data-tone={tone}
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-control px-2.5 text-caption font-semibold whitespace-nowrap ${style.chip}`}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}
