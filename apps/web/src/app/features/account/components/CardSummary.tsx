import { PaymentCard, StatusChip, type StatusTone } from '@acme/ui';
import { ChevronRight } from 'lucide-react';
import { Icon } from '@/app/components/UI/Icon';
import { t } from '@/app/i18n';

interface CardSummaryProps {
  last4: string;
  expiry: string;
  isFrozen: boolean;
  status: { label: string; tone: StatusTone };
  href: string;
}

/** The home's card strip: a thumbnail, •••• last4 and its status, linking to the card page. */
export function CardSummary({ last4, expiry, isFrozen, status, href }: CardSummaryProps) {
  return (
    <a
      href={href}
      data-tour="card-strip"
      className="group flex min-h-16 items-center gap-3 rounded-card border-[1.6px] border-ink bg-surface-raised p-3 shadow-raised transition-transform duration-fast ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
    >
      <PaymentCard
        size="thumb"
        brandName={t('app.name')}
        last4={last4}
        numberLabel={t('account.card.numberLabel', { last4 })}
        expiryLabel={t('account.card.expires')}
        expiry={expiry}
        isFrozen={isFrozen}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-caption font-semibold text-muted">{t('account.card.summary')}</span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-body font-medium tracking-widest tabular-nums">
            <span className="sr-only">{t('account.card.numberLabel', { last4 })}</span>
            <span aria-hidden="true">•••• {last4}</span>
          </span>
          <StatusChip tone={status.tone} label={status.label} />
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-small font-semibold text-violet">
        <span className="hidden sm:inline">{t('account.card.view')}</span>
        <span className="transition-transform duration-fast ease-out group-hover:translate-x-0.5">
          <Icon icon={ChevronRight} size={20} />
        </span>
      </span>
    </a>
  );
}
