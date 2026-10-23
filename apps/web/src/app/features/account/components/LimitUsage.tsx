import { AmountText, VaultMeter, type VaultSegment } from '@acme/ui';
import { t } from '@/app/i18n';

interface LimitUsageProps {
  limit: string;
  collateral: string;
  segments: VaultSegment[];
}

/**
 * The credit limit and how it is used: the limit, the security deposit that backs it, and the
 * meter split into owed · on hold · available, each named with its amount.
 */
export function LimitUsage({ limit, collateral, segments }: LimitUsageProps) {
  return (
    <section
      aria-labelledby="usage-title"
      className="flex flex-col gap-[clamp(0.75rem,2dvh,1.25rem)] rounded-card border-[1.6px] border-ink bg-surface-raised p-4 shadow-raised sm:p-[clamp(1rem,3.2dvh,2.5rem)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="usage-title" className="font-display text-body font-bold sm:text-h3">
          {t('account.usage.title')}
        </h2>
        <dl className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-small text-muted">{t('account.balances.limit')}</dt>
          <dd className="text-h3 font-medium">
            <AmountText value={limit} />
          </dd>
        </dl>
      </div>
      <VaultMeter
        label={t('account.meter.label')}
        collateral={{ label: t('account.meter.collateral'), amount: collateral }}
        segments={segments}
      />
    </section>
  );
}
