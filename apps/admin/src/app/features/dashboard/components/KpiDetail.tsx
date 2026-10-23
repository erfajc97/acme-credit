import type { ReactNode } from 'react';

/** What a card's figure means, under it. */
export function KpiDetail({ children }: { children: ReactNode }) {
  return <p className="text-caption text-muted sm:text-small">{children}</p>;
}
