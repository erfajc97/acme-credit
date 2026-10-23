import { CircleAlert, CircleCheck } from 'lucide-react';
import { Icon } from '@/app/components/UI/Icon';
import { t } from '@/app/i18n';
import type { ReconciliationView } from '../helpers/dashboardView';

/**
 * Per-account reconciliation, small on purpose: one calm line when every cached balance matches
 * its postings, an alert listing the accounts to check when some do not. Word + icon, never color
 * alone.
 */
export function ReconciliationSignal({ view }: { view: ReconciliationView }) {
  const counts = { checked: view.checked, mismatches: view.mismatches };
  if (view.isClean) {
    return (
      <p role="status" className="flex items-center gap-2 text-small text-muted">
        <span className="text-success">
          <Icon icon={CircleCheck} size={16} />
        </span>
        {t('dashboard.reconciliation.clean', counts)}
      </p>
    );
  }
  return (
    <section
      role="alert"
      aria-labelledby="reconciliation-title"
      className="flex flex-col gap-2 rounded-card border-[1.6px] border-danger bg-surface-raised px-4 py-3"
    >
      <h2 id="reconciliation-title" className="flex items-center gap-2 font-semibold text-danger">
        <Icon icon={CircleAlert} size={20} />
        {t('dashboard.reconciliation.mismatchTitle')}
      </h2>
      <p className="text-small text-fg">{t('dashboard.reconciliation.mismatchBody', counts)}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {view.accounts.map((account) => (
          <li key={account.id}>
            <a
              href={account.href}
              className="inline-flex min-h-11 items-center font-mono text-small font-semibold text-violet underline underline-offset-4 lg:min-h-8"
            >
              {t('dashboard.reconciliation.account', { id: account.shortId })}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
