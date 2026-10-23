import type { ReactNode } from 'react';

interface SectionTitleProps {
  /** Referenced by the section's `aria-labelledby`, so the region has a name (W10). */
  id: string;
  children: ReactNode;
}

/** A section's title in the console: Golos bold in violet (docs/brand.md › violet section titles). */
export function SectionTitle({ id, children }: SectionTitleProps) {
  return (
    <h2 id={id} className="font-display text-h3 font-bold tracking-tight text-violet">
      {children}
    </h2>
  );
}
