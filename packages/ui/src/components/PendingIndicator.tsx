import { Spinner } from '@heroui/react';

export interface PendingIndicatorProps {
  /** What the app is waiting for, in words (announced politely). */
  label: string;
}

export function PendingIndicator({ label }: PendingIndicatorProps) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-small text-muted">
      <Spinner size="sm" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
