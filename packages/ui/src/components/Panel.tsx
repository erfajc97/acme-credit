import type { ReactNode } from 'react';

export type PanelTone = 'raised' | 'inset' | 'cream' | 'lavender' | 'mint';

export interface PanelProps {
  children: ReactNode;
  /** Id of the heading inside the panel, so the region has a name (W10). */
  labelledBy?: string | undefined;
  /**
   * "raised" is the signature card (white, 1.6 px ink outline, hard offset shadow); "inset" is a
   * quieter secondary surface; the tints group content as soft bands (docs/brand.md).
   */
  tone?: PanelTone;
  /** "compact" is the back-office density: tighter padding and gaps on phones (W9). */
  density?: 'regular' | 'compact';
}

const SURFACE: Record<PanelTone, string> = {
  raised: 'border-[1.6px] border-ink bg-surface-raised shadow-raised',
  inset: 'bg-neutral-soft',
  cream: 'bg-cream',
  lavender: 'bg-lavender',
  mint: 'bg-mint',
};

const DENSITY = {
  regular: 'gap-4 p-5 md:p-6',
  compact: 'gap-3 p-3 sm:gap-4 sm:p-5 md:p-6',
} as const;

export function Panel({ children, labelledBy, tone = 'raised', density = 'regular' }: PanelProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`flex min-w-0 flex-col rounded-card ${DENSITY[density]} ${SURFACE[tone]}`}
    >
      {children}
    </section>
  );
}
