import { AppButton } from './AppButton';

export interface ErrorStateProps {
  title: string;
  /** What happened and what to do next. */
  body: string;
  retryLabel: string;
  retryingLabel: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

/** The error branch of every query (W13): the reason plus a retry. */
export function ErrorState({
  title,
  body,
  retryLabel,
  retryingLabel,
  onRetry,
  isRetrying = false,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-2">
      <h2 className="font-display text-h3 font-bold text-danger md:text-h3-lg">{title}</h2>
      <p className="max-w-prose text-body text-muted">{body}</p>
      <AppButton
        variant="secondary"
        onPress={onRetry}
        isPending={isRetrying}
        pendingLabel={retryingLabel}
      >
        {retryLabel}
      </AppButton>
    </div>
  );
}
