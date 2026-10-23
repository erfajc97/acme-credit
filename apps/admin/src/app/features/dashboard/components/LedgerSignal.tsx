import { AmountText } from '@acme/ui';
import { CircleAlert } from 'lucide-react';
import { Icon } from '@/app/components/UI/Icon';
import type { TrialBalanceView } from '@/app/helpers/journal';
import { t } from '@/app/i18n';

interface LedgerSignalProps {
  ledger: TrialBalanceView;
  ledgerHref: string;
}

/**
 * The money safety alert, shown only when the ledger does not balance (owner decision: a balanced
 * ledger is the normal state and needs no banner): word + icon + amount and the next step, never
 * color alone.
 */
export function LedgerSignal({ ledger, ledgerHref }: LedgerSignalProps) {
  return (
    <section
      role="alert"
      aria-labelledby="ledger-signal-title"
      className="flex flex-col gap-3 rounded-card border-[1.6px] border-danger bg-surface-raised px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-danger">
          <Icon icon={CircleAlert} size={20} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id="ledger-signal-title" className="font-semibold text-danger">
            {t('dashboard.ledgerUnbalancedTitle')}
          </h2>
          <p className="text-small text-fg">
            {t('dashboard.ledgerUnbalancedBody', { amount: ledger.amount })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 pl-8 sm:pl-0">
        <AmountText value={ledger.amount} />
        <a
          href={ledgerHref}
          className="inline-flex min-h-11 items-center text-small font-semibold whitespace-nowrap text-violet underline underline-offset-4"
        >
          {t('dashboard.openLedger')}
        </a>
      </div>
    </section>
  );
}
