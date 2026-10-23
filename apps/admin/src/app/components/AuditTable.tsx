import { DataTable, type DataColumn } from '@acme/ui';
import type { AuditRow } from '@/app/helpers/audit';
import { shortId } from '@/app/helpers/journal';
import { t } from '@/app/i18n';

/** Built at render time, in the page's locale (a module constant would freeze one language). */
function auditColumns(): DataColumn<AuditRow>[] {
  return [
    {
      id: 'action',
      header: t('audit.action'),
      isPrimary: true,
      cell: (row) => <span className="font-mono">{row.action}</span>,
    },
    {
      id: 'time',
      mobile: 'meta',
      header: t('audit.time'),
      cell: (row) => <time className="whitespace-nowrap">{row.time}</time>,
    },
    {
      id: 'actor',
      header: t('audit.actor'),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{t(row.actorKey)}</span>
          {row.actorId && (
            <span className="font-mono text-caption text-muted" title={row.actorId}>
              {shortId(row.actorId)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'entity',
      header: t('audit.entity'),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.entityType}</span>
          {row.entityHref ? (
            <a
              href={row.entityHref}
              className="font-mono text-caption text-violet underline underline-offset-2"
              title={row.entityId}
            >
              {shortId(row.entityId)}
            </a>
          ) : (
            <span className="font-mono text-caption break-all text-muted">{row.entityId}</span>
          )}
        </span>
      ),
    },
    {
      id: 'request',
      header: t('audit.requestId'),
      cell: (row) => (
        <span className="font-mono text-caption break-all">
          {row.requestId ?? t('common.none')}
        </span>
      ),
    },
  ];
}

/** The audit trail: who did what, to which entity, when, and under which request id. */
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <DataTable
      density="compact"
      caption={t('audit.caption')}
      columns={auditColumns()}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  );
}
