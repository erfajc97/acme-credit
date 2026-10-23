import { AmountText, Skeleton, StatusChip } from '@acme/ui';
import type { TrialBalanceView } from '@/app/helpers/journal';
import { t } from '@/app/i18n';

/** Mint band when it balances, a danger outline when it does not, neutral while unknown. */
const SURFACE = {
  unknown: 'bg-neutral-soft',
  balanced: 'bg-mint',
  unbalanced: 'border-[1.6px] border-danger bg-surface-raised',
} as const;

interface TrialBalanceProps {
  view: TrialBalanceView | null;
  isUnavailable: boolean;
}

/** The ledger's header line: the sum of every posting, and whether it is zero, in words. */
export function TrialBalance({ view, isUnavailable }: TrialBalanceProps) {
  const surface = SURFACE[view === null ? 'unknown' : view.isBalanced ? 'balanced' : 'unbalanced'];
  return (
    <div
      role={view && !view.isBalanced ? 'alert' : 'status'}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-card px-4 py-3 ${surface}`}
    >
      <span className="text-small font-semibold text-fg">{t('ledger.trialBalance')}</span>
      {view ? (
        <span className="flex items-center gap-3">
          <AmountText value={view.amount} />
          <StatusChip
            tone={view.isBalanced ? 'success' : 'danger'}
            label={
              view.isBalanced
                ? t('dashboard.ledgerBalancedTitle')
                : t('dashboard.ledgerUnbalancedTitle')
            }
          />
        </span>
      ) : isUnavailable ? (
        <span className="text-small text-muted">{t('ledger.trialBalanceUnavailable')}</span>
      ) : (
        <Skeleton className="h-5 w-40 rounded-control" />
      )}
    </div>
  );
}
