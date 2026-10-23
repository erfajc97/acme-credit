import { AmountText, ErrorState, Panel, StatusChip } from '@acme/ui';
import { CircleCheck } from 'lucide-react';
import { RowsSkeleton } from '@/app/components/RowsSkeleton';
import { SectionTitle } from '@/app/components/SectionTitle';
import { Icon } from '@/app/components/UI/Icon';
import { t } from '@/app/i18n';
import type { AlertItem } from '../helpers/dashboardSamples';
import type { SampleState } from '../hooks/useDashboard';

interface AlertsPanelProps {
  alerts: { state: SampleState; items: AlertItem[] };
}

const KIND = {
  payoutFailed: {
    tone: 'danger',
    labelKey: 'dashboard.alerts.payoutFailed',
    atKey: 'dashboard.alerts.failedAt',
  },
  holdExpiring: {
    tone: 'warning',
    labelKey: 'dashboard.alerts.holdExpiring',
    atKey: 'dashboard.alerts.expiresAt',
  },
} as const;

/** What needs a person now: payouts that failed for good, then holds about to lapse. */
export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const { state, items } = alerts;
  let body;
  if (state.isLoading) body = <RowsSkeleton label={t('dashboard.alerts.loading')} />;
  else if (state.isError) {
    body = (
      <ErrorState
        title={t('dashboard.alerts.failed')}
        body={t('dashboard.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={state.retry}
        isRetrying={state.isRetrying}
      />
    );
  } else if (items.length === 0) {
    body = (
      <p className="flex items-start gap-2 rounded-field bg-mint p-3 text-small text-fg">
        <span className="text-success">
          <Icon icon={CircleCheck} size={20} />
        </span>
        {t('dashboard.alerts.none')}
      </p>
    );
  } else {
    body = (
      <ul aria-label={t('dashboard.alerts.title')} className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="border-b border-border last:border-b-0">
            <a
              href={item.href ?? undefined}
              className="-mx-2 flex min-h-11 flex-col gap-1 rounded-field px-2 py-3 transition-colors duration-fast hover:bg-neutral-soft focus-visible:outline-2 focus-visible:outline-violet"
            >
              <span className="flex items-center justify-between gap-3">
                <StatusChip tone={KIND[item.kind].tone} label={t(KIND[item.kind].labelKey)} />
                <AmountText value={item.amount} />
              </span>
              <span className="truncate font-semibold">
                {item.name ?? t('purchases.noCustomer')}
              </span>
              <span className="flex flex-wrap gap-x-2 text-caption text-muted">
                {item.detail && <span className="font-mono break-all">{item.detail}</span>}
                {item.at && <span>{t(KIND[item.kind].atKey, { time: item.at })}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <Panel labelledBy="alerts-title" density="compact">
      <SectionTitle id="alerts-title">{t('dashboard.alerts.title')}</SectionTitle>
      {body}
    </Panel>
  );
}
