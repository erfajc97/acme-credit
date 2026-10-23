import { AmountText, StatusChip } from '@acme/ui';
import { HandCoins, Hourglass, PiggyBank, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import { t } from '@/app/i18n';
import type { DashboardView } from '../helpers/dashboardView';
import type { HoldsKpi, PayoutsKpi } from '../hooks/useDashboard';
import { KpiCard } from './KpiCard';
import { KpiDetail } from './KpiDetail';
import { KpiFigure } from './KpiFigure';
import { SampleFigure } from './SampleFigure';

interface KpiGridProps {
  view: DashboardView;
  holds: HoldsKpi;
  payouts: PayoutsKpi;
}

/**
 * The six figures an operator scans first, in the order money flows: who is active, the deposits
 * that back the lending, how much of it is in use, the last 24 h of purchases, holds about to
 * lapse and money on its way back to customers.
 */
export function KpiGrid({ view, holds, payouts }: KpiGridProps) {
  return (
    <section aria-labelledby="kpi-title" className="flex flex-col gap-2 sm:gap-3" data-tour="kpis">
      <h2 id="kpi-title" className="text-caption font-semibold tracking-wide text-muted uppercase">
        {t('dashboard.kpi.title')}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3">
        <KpiCard
          id="kpi-accounts"
          label={t('dashboard.kpi.activeAccounts')}
          icon={Users}
          tone="success"
          link={{ href: view.accounts.activeHref, label: t('dashboard.kpi.viewActive') }}
        >
          <KpiFigure>{view.accounts.active}</KpiFigure>
          <KpiDetail>
            {t('dashboard.kpi.activeDetail', {
              frozen: view.accounts.frozen,
              total: view.accounts.total,
            })}
          </KpiDetail>
        </KpiCard>
        <KpiCard
          id="kpi-collateral"
          label={t('dashboard.kpi.collateral')}
          icon={ShieldCheck}
          tone="violet"
        >
          <KpiFigure>
            <AmountText value={view.collateral.amount} />
          </KpiFigure>
          <KpiDetail>
            {t('dashboard.kpi.collateralDetail', { limit: view.collateral.limit })}
          </KpiDetail>
        </KpiCard>
        <KpiCard
          id="kpi-credit-used"
          label={t('dashboard.kpi.creditUsed')}
          icon={PiggyBank}
          tone="neutral"
        >
          <KpiFigure>{view.creditUsed.label}</KpiFigure>
          <div
            aria-hidden="true"
            className="h-3 w-full overflow-hidden rounded-control border-[1.6px] border-ink bg-neutral-soft"
          >
            <div className="h-full bg-brand-500" style={{ width: `${view.creditUsed.percent}%` }} />
          </div>
          <KpiDetail>
            {t('dashboard.kpi.creditUsedDetail', {
              used: view.creditUsed.used,
              limit: view.creditUsed.limit,
            })}
          </KpiDetail>
        </KpiCard>
        <KpiCard
          id="kpi-purchases"
          label={t('dashboard.kpi.purchases24h')}
          icon={ShoppingBag}
          tone="neutral"
        >
          <dl className="flex flex-wrap items-end gap-x-3 gap-y-2 sm:gap-x-6">
            <div className="flex flex-col gap-1">
              <dt>
                <StatusChip tone="success" label={t('dashboard.approved')} />
              </dt>
              <dd className="font-display text-h3 leading-none font-bold tabular-nums sm:text-h2 lg:text-h2-lg">
                {view.purchases24h.approved}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt>
                <StatusChip tone="danger" label={t('dashboard.declined')} />
              </dt>
              <dd className="font-display text-h3 leading-none font-bold tabular-nums sm:text-h2 lg:text-h2-lg">
                {view.purchases24h.declined}
              </dd>
            </div>
          </dl>
          <KpiDetail>
            {view.purchases24h.declineRate
              ? t('dashboard.kpi.declineRate', { rate: view.purchases24h.declineRate })
              : t('dashboard.kpi.noPurchases24h')}
          </KpiDetail>
        </KpiCard>
        <KpiCard
          id="kpi-holds"
          label={t('dashboard.kpi.holdsExpiring')}
          icon={Hourglass}
          tone={holds.tone}
          link={{ href: holds.href, label: t('dashboard.kpi.viewHolds') }}
        >
          <SampleFigure state={holds.state}>
            <KpiFigure>{holds.count}</KpiFigure>
            <KpiDetail>{t('dashboard.kpi.holdsDetail', { amount: holds.total })}</KpiDetail>
          </SampleFigure>
        </KpiCard>
        <KpiCard
          id="kpi-payouts"
          label={t('dashboard.kpi.payouts')}
          icon={HandCoins}
          tone={payouts.tone}
          link={{ href: payouts.href, label: t('dashboard.kpi.viewPayouts') }}
        >
          <SampleFigure state={payouts.state}>
            <dl className="flex flex-wrap items-end gap-x-3 gap-y-2 sm:gap-x-6">
              <div className="flex flex-col gap-1">
                <dt>
                  <StatusChip tone="warning" label={t('status.payout.PENDING')} />
                </dt>
                <dd className="font-display text-h3 leading-none font-bold tabular-nums sm:text-h2 lg:text-h2-lg">
                  {payouts.pending}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt>
                  <StatusChip tone="danger" label={t('status.payout.FAILED')} />
                </dt>
                <dd className="font-display text-h3 leading-none font-bold tabular-nums sm:text-h2 lg:text-h2-lg">
                  {payouts.failed}
                </dd>
              </div>
            </dl>
            <KpiDetail>{t('dashboard.kpi.payoutsDetail')}</KpiDetail>
          </SampleFigure>
        </KpiCard>
      </div>
    </section>
  );
}
