import { AmountText, DataTable, StatusChip, type DataColumn } from '@acme/ui';
import { HoldFacts } from '@/app/components/HoldFacts';
import { OrderLines } from '@/app/components/OrderLines';
import type { MouseEvent } from 'react';
import type { ReleaseTarget } from '@/app/helpers/holds';
import type { PurchaseRow } from '@/app/helpers/orders';
import { t } from '@/app/i18n';

/** Built at render time, in the page's locale (a module constant would freeze one language). */
function purchaseColumns({
  onRelease,
  detailHref,
  onOpenDetail,
}: Omit<PurchasesTableProps, 'rows'>): DataColumn<PurchaseRow>[] {
  return [
    {
      id: 'merchant',
      header: t('purchases.columns.merchant'),
      isPrimary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5 lg:min-w-60">
          <a
            href={detailHref(row.id)}
            onClick={onOpenDetail(row.id)}
            aria-label={t('purchaseDetail.open', { merchant: row.merchant })}
            className="inline-flex min-h-11 items-center self-start font-semibold text-violet underline underline-offset-4 lg:min-h-8"
          >
            {row.merchant}
          </a>
          <span className="font-mono text-caption text-muted">
            {t('purchases.mcc', { mcc: row.mcc })}
          </span>
          <OrderLines merchant={row.merchant} lines={row.lines} />
        </span>
      ),
    },
    {
      id: 'customer',
      header: t('purchases.columns.customer'),
      cell: (row) =>
        row.customer ? (
          <span className="flex min-w-0 flex-col">
            {row.accountHref ? (
              <a
                href={row.accountHref}
                className="font-semibold text-violet underline-offset-2 hover:underline"
              >
                {row.customer.name}
              </a>
            ) : (
              <span className="font-semibold">{row.customer.name}</span>
            )}
            <span className="text-caption break-all text-muted">{row.customer.email}</span>
          </span>
        ) : (
          <span className="text-muted">{t('purchases.noCustomer')}</span>
        ),
    },
    {
      id: 'date',
      mobile: 'meta',
      header: t('purchases.columns.date'),
      cell: (row) => <time className="whitespace-nowrap">{row.time}</time>,
    },
    {
      id: 'status',
      mobile: 'meta',
      header: t('purchases.columns.status'),
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <StatusChip tone={row.tone} label={t(row.statusKey)} />
          {row.reasonKey && <span className="text-caption text-danger">{t(row.reasonKey)}</span>}
          <HoldFacts hold={row.hold} release={row.release} onRelease={onRelease} />
        </span>
      ),
    },
    {
      id: 'amount',
      mobile: 'end',
      header: t('purchases.columns.amount'),
      align: 'end',
      cell: (row) => <AmountText value={row.amount} />,
    },
    {
      id: 'captured',
      header: t('purchases.columns.captured'),
      align: 'end',
      cell: (row) =>
        row.captured ? (
          <AmountText value={row.captured} />
        ) : (
          <span className="text-muted">{t('common.none')}</span>
        ),
    },
  ];
}

interface PurchasesTableProps {
  rows: PurchaseRow[];
  onRelease: (target: ReleaseTarget) => void;
  /** The purchase's own link (`?purchase=<id>`) and the click that opens its sheet in place. */
  detailHref: (purchaseId: string) => string;
  onOpenDetail: (purchaseId: string) => (event: MouseEvent) => void;
}

/**
 * Purchases as a dense table on desktop and as cards on phones; the merchant opens the purchase's
 * detail sheet, the items unfold per row, and a live hold offers "Release hold" under its status.
 */
export function PurchasesTable({ rows, ...actions }: PurchasesTableProps) {
  return (
    <DataTable
      density="compact"
      caption={t('purchases.tableCaption')}
      columns={purchaseColumns(actions)}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  );
}
