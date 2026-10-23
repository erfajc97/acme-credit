import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  body: string;
  /** The first action the empty state teaches (docs/brand.md › Voice). */
  action?: ReactNode;
  icon?: ReactNode;
  headingLevel?: 2 | 3;
}

export function EmptyState({ title, body, action, icon, headingLevel = 2 }: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-card bg-lavender text-violet">
          {icon}
        </span>
      )}
      <Heading className="font-display text-h3 font-bold md:text-h3-lg">{title}</Heading>
      <p className="max-w-prose text-body text-muted">{body}</p>
      {action}
    </div>
  );
}
