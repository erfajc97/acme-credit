import { StatusChip, type StatusTone } from '@acme/ui';
import { t } from '@/app/i18n';

interface CardDetailsProps {
  holderName: string;
  last4: string;
  expiry: string;
  status: { label: string; tone: StatusTone };
}

/** The card's details as a short list: cardholder, masked number, expiry and status in words. */
export function CardDetails({ holderName, last4, expiry, status }: CardDetailsProps) {
  return (
    <section
      aria-labelledby="card-details-title"
      className="flex flex-col gap-3 rounded-card bg-neutral-soft p-4 sm:p-5"
    >
      <h2 id="card-details-title" className="font-display text-body font-bold">
        {t('card.detailsTitle')}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-small sm:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))]">
        <div className="col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-1">
          <dt className="text-muted">{t('card.holder')}</dt>
          <dd className="truncate font-medium">{holderName}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted">{t('card.number')}</dt>
          <dd className="font-mono font-medium tracking-wider tabular-nums">
            <span className="sr-only">{t('account.card.numberLabel', { last4 })}</span>
            <span aria-hidden="true">•••• {last4}</span>
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted">{t('account.card.expires')}</dt>
          <dd className="font-mono font-medium tabular-nums">{expiry}</dd>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <dt className="text-muted">{t('card.status')}</dt>
          <dd>
            <StatusChip tone={status.tone} label={status.label} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
