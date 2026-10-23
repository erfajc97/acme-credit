import { AmountText, AppButton, ButtonLink } from '@acme/ui';
import { t } from '@/app/i18n';

interface AvailableHeroProps {
  greeting: string;
  available: string;
  storeHref: string;
  onPayment: () => void;
  onDeposit: () => void;
}

/**
 * The one loud thing on the home: what is available to spend, with the quick actions under it
 * (the store is the only yellow action). The figure scales with the screen's height.
 */
export function AvailableHero({
  greeting,
  available,
  storeHref,
  onPayment,
  onDeposit,
}: AvailableHeroProps) {
  return (
    <section
      aria-labelledby="balances-title"
      data-tour="available"
      className="flex flex-col gap-[clamp(0.75rem,2.2dvh,1.5rem)] rounded-card border-[1.6px] border-ink bg-surface-raised p-4 shadow-raised sm:p-[clamp(1rem,3.2dvh,2.5rem)] lg:h-full"
    >
      <h2 id="balances-title" className="sr-only">
        {t('account.balances.title')}
      </h2>
      <div className="flex flex-col justify-center gap-1 rounded-field bg-cream px-4 py-[clamp(0.75rem,2.6dvh,2rem)] sm:px-[clamp(1rem,2.4dvh,2rem)] lg:flex-1">
        {greeting && <p className="font-display text-small font-bold text-violet">{greeting}</p>}
        <dl className="flex flex-col gap-1">
          <dt className="text-small font-medium text-muted">{t('account.balances.available')}</dt>
          <dd className="pt-1 font-mono text-[min(clamp(2.25rem,6.6dvh,4.5rem),11vw)] leading-none font-medium tracking-tight lg:text-[clamp(2.75rem,min(11dvh,5vw),7.5rem)]">
            <AmountText value={available} />
          </dd>
        </dl>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-[1.4fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2 2xl:col-span-1">
          <ButtonLink href={storeHref} fullWidth>
            {t('account.actions.shop')}
          </ButtonLink>
        </div>
        <AppButton variant="secondary" fullWidth onPress={onPayment}>
          {t('account.actions.payment')}
        </AppButton>
        <AppButton variant="secondary" fullWidth onPress={onDeposit}>
          {t('account.actions.deposit')}
        </AppButton>
      </div>
    </section>
  );
}
