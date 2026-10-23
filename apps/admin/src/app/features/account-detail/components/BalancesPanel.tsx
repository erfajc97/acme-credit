import { AmountStat, Panel, VaultMeter } from '@acme/ui';
import { SectionTitle } from '@/app/components/SectionTitle';
import { t } from '@/app/i18n';
import type { BalancesView } from '../hooks/useAccountDetail';

/** Collateral, limit, held, owed and available side by side (never one balance), plus the meter. */
export function BalancesPanel({ balances }: { balances: BalancesView }) {
  return (
    <Panel labelledBy="balances-title" density="compact">
      <SectionTitle id="balances-title">{t('accountDetail.balancesTitle')}</SectionTitle>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <AmountStat label={t('accountDetail.collateral')} value={balances.collateral} />
        <AmountStat label={t('accountDetail.limit')} value={balances.limit} />
        <AmountStat label={t('accountDetail.held')} value={balances.held} />
        <AmountStat label={t('accountDetail.owed')} value={balances.owed} />
        <AmountStat label={t('accountDetail.available')} value={balances.available} />
      </dl>
      <VaultMeter
        label={t('accountDetail.meterLabel')}
        collateral={{ label: t('accountDetail.collateral'), amount: balances.collateral }}
        segments={balances.segments}
      />
    </Panel>
  );
}
