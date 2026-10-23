import { AppButton, Skeleton } from '@acme/ui';
import type { ReactNode } from 'react';
import { t } from '@/app/i18n';
import type { SampleState } from '../hooks/useDashboard';

/** A figure read from a side list: a skeleton while it loads, a retry when it failed (W13). */
export function SampleFigure({ state, children }: { state: SampleState; children: ReactNode }) {
  if (state.isLoading) {
    return (
      <div role="status" className="flex flex-col gap-2">
        <span className="sr-only">{t('dashboard.kpi.loading')}</span>
        <Skeleton className="h-9 w-24 rounded-control" />
        <Skeleton className="h-4 w-40 max-w-full rounded-control" />
      </div>
    );
  }
  if (state.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-small text-danger">{t('dashboard.kpi.failed')}</p>
        <AppButton
          variant="secondary"
          size="compact"
          onPress={state.retry}
          isPending={state.isRetrying}
          pendingLabel={t('common.retrying')}
        >
          {t('common.retry')}
        </AppButton>
      </div>
    );
  }
  return <>{children}</>;
}
