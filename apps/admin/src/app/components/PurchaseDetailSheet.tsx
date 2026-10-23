import { AmountText, AppSheet, EmptyState, SafeImage, StatusChip } from '@acme/ui';
import type { DetailLine, PurchaseDetail, TimelineTone } from '@/app/helpers/purchaseDetail';
import type { PurchaseDetailView } from '@/app/hooks/usePurchaseDetail';
import { t } from '@/app/i18n';
import type { ReactNode } from 'react';
import { RowsSkeleton } from './RowsSkeleton';

const DOT: Record<TimelineTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  neutral: 'bg-muted',
  pending: 'border-[1.6px] border-ink bg-surface-raised',
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </div>
  );
}

/** Product illustrations are 16:10; a lettered tile stands in when one is missing. */
function LineImage({ line }: { line: DetailLine }) {
  return (
    <SafeImage
      key={line.imageSrc}
      src={line.imageSrc}
      alt=""
      width={80}
      height={50}
      className="h-12.5 w-20 shrink-0 rounded-field border border-border bg-neutral-soft object-cover"
      fallback={
        <span
          aria-hidden="true"
          className="flex h-12.5 w-20 shrink-0 items-center justify-center rounded-field border border-border bg-neutral-soft font-display text-h3 font-bold text-muted"
        >
          {line.name.slice(0, 1)}
        </span>
      }
    />
  );
}

function DetailBody({ detail }: { detail: PurchaseDetail }) {
  return (
    <>
      <dl className="grid grid-cols-1 gap-3 text-small sm:grid-cols-2">
        <Fact label={t('purchaseDetail.merchant')}>
          <span className="font-semibold">{detail.merchant}</span>{' '}
          <span className="font-mono text-caption text-muted">
            {t('purchases.mcc', { mcc: detail.mcc })}
          </span>
        </Fact>
        <Fact label={t('purchaseDetail.customer')}>
          {detail.customer ? (
            <>
              <span className="block font-semibold">{detail.customer.name}</span>
              <span className="block text-caption break-all text-muted">
                {detail.customer.email}
              </span>
            </>
          ) : (
            <span className="text-muted">{t('purchases.noCustomer')}</span>
          )}
        </Fact>
        <Fact label={t('purchaseDetail.date')}>
          <time>{detail.date}</time>
        </Fact>
        <Fact label={t('purchaseDetail.status')}>
          <StatusChip tone={detail.tone} label={t(detail.statusKey)} />
        </Fact>
      </dl>
      <section aria-labelledby="purchase-timeline-title" className="flex flex-col gap-2">
        <h3 id="purchase-timeline-title" className="font-semibold">
          {t('purchaseDetail.timelineTitle')}
        </h3>
        <ol className="flex flex-col gap-3 border-l border-border pl-4">
          {detail.timeline.map((step) => (
            <li key={step.key} className="relative flex flex-col gap-0.5 text-small">
              <span
                aria-hidden="true"
                className={`absolute top-1.5 -left-5.5 size-3 rounded-full ${DOT[step.tone]}`}
              />
              <span className="font-semibold">{t(step.labelKey, step.params)}</span>
              {step.reasonKey && <span className="text-muted">{t(step.reasonKey)}</span>}
              <time className="text-caption text-muted">{step.time}</time>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="purchase-items-title" className="flex flex-col gap-2">
        <h3 id="purchase-items-title" className="font-semibold">
          {t('purchaseDetail.itemsTitle')}
        </h3>
        {detail.lines.length === 0 ? (
          <p className="text-small text-muted">{t('orders.noItems')}</p>
        ) : (
          <ul className="flex flex-col">
            {detail.lines.map((line) => (
              <li
                key={line.key}
                className="flex items-center gap-3 border-b border-border py-2 text-small last:border-b-0"
              >
                <LineImage line={line} />
                <span className="flex min-w-0 grow flex-col">
                  <span className="font-semibold">{line.name}</span>
                  <span className="text-caption text-muted">
                    {t('purchaseDetail.lineQuantity', {
                      quantity: line.quantity,
                      unit: line.unit,
                    })}
                  </span>
                </span>
                <AmountText value={line.subtotal} />
              </li>
            ))}
          </ul>
        )}
        <dl className="flex flex-col gap-1 border-t border-border-strong pt-2">
          <div className="flex items-center justify-between gap-3 font-semibold">
            <dt>{t('purchaseDetail.total')}</dt>
            <dd>
              <AmountText value={detail.total} />
            </dd>
          </div>
          {detail.captured && (
            <div className="flex items-center justify-between gap-3 text-small text-muted">
              <dt>{t('purchaseDetail.captured')}</dt>
              <dd>
                <AmountText value={detail.captured} />
              </dd>
            </div>
          )}
        </dl>
      </section>
    </>
  );
}

/**
 * The order behind a purchase: merchant, customer, date, what happened (approved, charged,
 * declined and why, released, when the hold lapses) and every line with its product image. A
 * bottom sheet on phones, a side panel from lg.
 */
export function PurchaseDetailSheet({ view }: { view: PurchaseDetailView }) {
  return (
    <AppSheet
      isOpen={view.isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) view.close();
      }}
      title={t('purchaseDetail.title')}
      closeLabel={t('purchaseDetail.close')}
      placement="auto"
    >
      {view.detail && <DetailBody detail={view.detail} />}
      {view.isLoading && <RowsSkeleton label={t('purchases.loading')} />}
      {view.isNotFound && (
        <EmptyState
          title={t('purchaseDetail.notFoundTitle')}
          body={t('purchaseDetail.notFoundBody')}
          headingLevel={3}
        />
      )}
    </AppSheet>
  );
}
