import { AmountText, DataTable, StatusChip, type DataColumn } from '@acme/ui';
import { HoldFacts } from '@/app/components/HoldFacts';
import { OrderLines } from '@/app/components/OrderLines';
import type { MouseEvent } from 'react';
import type { ReleaseTarget } from '@/app/helpers/holds';
import { t } from '@/app/i18n';
import type { AuthorizationRow } from '../helpers/authorizationRows';

/** Built at render time, in the page's locale (a module constant would freeze one language). */
function authorizationColumns({
  onRelease,
  detailHref,
  onOpenDetail,
}: Omit<AuthorizationsTableProps, 'rows'>): DataColumn<AuthorizationRow>[] {
  return [
    {
      id: 'merchant',
      header: t('accountDetail.authorizations.merchant'),
      isPrimary: true,
      cell: (row) => (
        <span className="flex flex-col gap-0.5 lg:min-w-60">
          <a
            href={detailHref(row.id)}
            onClick={onOpenDetail(row.id)}
            aria-label={t('purchaseDetail.open', { merchant: row.merchant })}
            className="inline-flex min-h-11 items-center self-start font-semibold text-violet underline underline-offset-4 lg:min-h-8"
          >
            {row.merchant}
          </a>
          <span className="font-mono text-caption text-muted">
            {t('accountDetail.authorizations.mcc', { mcc: row.mcc })}
          </span>
          <OrderLines merchant={row.merchant} lines={row.lines} />
        </span>
      ),
    },
    {
      id: 'time',
      mobile: 'meta',
      header: t('accountDetail.authorizations.time'),
      cell: (row) => <time className="whitespace-nowrap">{row.time}</time>,
    },
    {
      id: 'status',
      mobile: 'meta',
      header: t('accountDetail.authorizations.status'),
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <StatusChip tone={row.tone} label={t(row.statusKey)} />
          <HoldFacts hold={row.hold} release={row.release} onRelease={onRelease} />
        </span>
      ),
    },
    {
      id: 'reason',
      header: t('accountDetail.authorizations.reason'),
      cell: (row) =>
        row.reasonKey ? t(row.reasonKey) : <span className="text-muted">{t('common.none')}</span>,
    },
    {
      id: 'amount',
      mobile: 'end',
      header: t('accountDetail.authorizations.amount'),
      align: 'end',
      cell: (row) => <AmountText value={row.amount} />,
    },
    {
      id: 'captured',
      header: t('accountDetail.authorizations.captured'),
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

interface AuthorizationsTableProps {
  rows: AuthorizationRow[];
  onRelease: (target: ReleaseTarget) => void;
  /** The purchase's own link (`?purchase=<id>`) and the click that opens its sheet in place. */
  detailHref: (purchaseId: string) => string;
  onOpenDetail: (purchaseId: string) => (event: MouseEvent) => void;
}

export function AuthorizationsTable({ rows, ...actions }: AuthorizationsTableProps) {
  return (
    <DataTable
      density="compact"
      caption={t('accountDetail.authorizations.caption')}
      columns={authorizationColumns(actions)}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  );
}
