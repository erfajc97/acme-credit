import type { ReactNode } from 'react';

export interface DataColumn<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Amounts and counts are right-aligned (docs/brand.md › Amounts). */
  align?: 'start' | 'end';
  /** On phones this column is the card's title instead of a label/value pair. */
  isPrimary?: boolean;
  /**
   * Compact cards only: `end` sits right of the title (amounts), `meta` joins the line under it
   * without a label (a status chip, a date); otherwise the column is a label/value pair.
   */
  mobile?: 'end' | 'meta';
}

export interface DataTableProps<Row> {
  /** Names the table for assistive tech (visually hidden). */
  caption: string;
  columns: DataColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /**
   * "compact" phone cards (back office): the title with its `end` columns on one line, the `meta`
   * columns on the next, and the remaining pairs two per row.
   */
  density?: 'regular' | 'compact';
}

interface CardProps<Row> {
  row: Row;
  primary: DataColumn<Row> | undefined;
  details: DataColumn<Row>[];
}

function Pairs<Row>({ row, columns }: { row: Row; columns: DataColumn<Row>[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
      {columns.map((column) => (
        <div key={column.id} className="contents">
          <dt className="text-muted">{column.header}</dt>
          <dd className={`min-w-0 wrap-break-word ${column.align === 'end' ? 'text-right' : ''}`}>
            {column.cell(row)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RegularCard<Row>({ row, primary, details }: CardProps<Row>) {
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      {primary && <div className="min-w-0 font-medium">{primary.cell(row)}</div>}
      <Pairs row={row} columns={details} />
    </li>
  );
}

function CompactCard<Row>({ row, primary, details }: CardProps<Row>) {
  const end = details.filter((column) => column.mobile === 'end');
  const meta = details.filter((column) => column.mobile === 'meta');
  const pairs = details.filter((column) => column.mobile === undefined);
  return (
    <li className="flex flex-col gap-1.5 border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        {primary && <div className="min-w-0 grow font-medium">{primary.cell(row)}</div>}
        {end.length > 0 && (
          <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
            {end.map((column) => (
              <div key={column.id}>{column.cell(row)}</div>
            ))}
          </div>
        )}
      </div>
      {meta.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted">
          {meta.map((column) => (
            <div key={column.id} className="min-w-0">
              {column.cell(row)}
            </div>
          ))}
        </div>
      )}
      {pairs.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-small">
          {pairs.map((column) => (
            <div key={column.id} className="flex min-w-0 flex-col">
              <dt className="text-caption text-muted">{column.header}</dt>
              <dd className="min-w-0 wrap-break-word">{column.cell(row)}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

/**
 * A dense table with hairline ledger rules (no zebra stripes) from `lg`, and the same rows as
 * cards below it (W9: no horizontal scroll at 360 px). Only one of the two is displayed, so
 * assistive tech meets each row once.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  density = 'regular',
}: DataTableProps<Row>) {
  const primary = columns.find((column) => column.isPrimary);
  const details = columns.filter((column) => !column.isPrimary);
  const Card = density === 'compact' ? CompactCard : RegularCard;
  return (
    <>
      <ul aria-label={caption} className="flex flex-col lg:hidden">
        {rows.map((row) => (
          <Card key={getRowKey(row)} row={row} primary={primary} details={details} />
        ))}
      </ul>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-small">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border-strong">
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`px-3 py-2 text-caption font-medium tracking-wide whitespace-nowrap text-muted uppercase ${column.align === 'end' ? 'text-right' : 'text-left'}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-b border-border last:border-b-0 hover:bg-neutral-soft"
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-3 py-2 align-top ${column.align === 'end' ? 'text-right' : 'text-left'}`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
