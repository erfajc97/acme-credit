import { AmountText } from '@acme/ui';

export interface PostingsTableRow {
  key: string;
  /** The ledger account's name in words, or null when only the code is known. */
  name: string | null;
  ledgerAccount: string;
  debit: string | null;
  credit: string | null;
}

export interface PostingsTableProps {
  caption: string;
  accountHeader: string;
  debitHeader: string;
  creditHeader: string;
  rows: PostingsTableRow[];
}

/**
 * The postings of one journal entry in the ledger's own shape: debit and credit columns,
 * tabular mono figures right-aligned, hairline rules. Three columns fit at 360 px: the ledger
 * account wraps, the amounts never do.
 */
export function PostingsTable({
  caption,
  accountHeader,
  debitHeader,
  creditHeader,
  rows,
}: PostingsTableProps) {
  return (
    <table className="w-full table-fixed border-collapse text-small">
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        <col />
        <col className="w-24 sm:w-32" />
        <col className="w-24 sm:w-32" />
      </colgroup>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="py-1.5 pr-2 text-left text-caption font-medium text-muted">
            {accountHeader}
          </th>
          <th scope="col" className="py-1.5 pl-2 text-right text-caption font-medium text-muted">
            {debitHeader}
          </th>
          <th scope="col" className="py-1.5 pl-2 text-right text-caption font-medium text-muted">
            {creditHeader}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-border last:border-b-0">
            <td className="py-1.5 pr-2 align-top">
              {row.name && <span className="block">{row.name}</span>}
              <span className="block font-mono text-caption break-all text-muted">
                {row.ledgerAccount}
              </span>
            </td>
            <td className="py-1.5 pl-2 text-right align-top">
              {row.debit && <AmountText value={row.debit} />}
            </td>
            <td className="py-1.5 pl-2 text-right align-top">
              {row.credit && <AmountText value={row.credit} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
