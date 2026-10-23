import { Panel, StatusChip } from '@acme/ui';
import { SectionTitle } from '@/app/components/SectionTitle';
import { t } from '@/app/i18n';
import type { DashboardView } from '../helpers/dashboardView';

/** Accounts by status, each a link to the filtered list. */
export function AccountsByStatus({ view }: { view: DashboardView }) {
  return (
    <Panel labelledBy="accounts-by-status-title" density="compact">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle id="accounts-by-status-title">{t('dashboard.accountsTitle')}</SectionTitle>
        <span className="text-small text-muted">
          {t('dashboard.accountsTotal', { count: view.accounts.total })}
        </span>
      </div>
      {!view.hasAccounts && <p className="text-small text-muted">{t('dashboard.noAccounts')}</p>}
      <ul className="-mx-2 flex flex-col">
        {view.statuses.map((row) => (
          <li key={row.status} className="border-b border-border last:border-b-0">
            <a
              href={row.href}
              aria-label={t('dashboard.viewAccounts', { status: t(row.labelKey) })}
              className="flex min-h-11 items-center justify-between gap-4 rounded-field px-2 transition-colors duration-fast hover:bg-neutral-soft focus-visible:outline-2 focus-visible:outline-violet"
            >
              <StatusChip tone={row.tone} label={t(row.labelKey)} />
              <span className="font-mono tabular-nums">{row.count}</span>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
