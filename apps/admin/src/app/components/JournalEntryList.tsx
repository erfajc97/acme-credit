import { PostingsTable, StatusChip } from '@acme/ui';
import type { JournalEntryRow } from '@/app/helpers/journal';
import { shortId } from '@/app/helpers/journal';
import { t } from '@/app/i18n';
import { accountHref } from '@/app/lib/endpoints';

interface JournalEntryListProps {
  entries: JournalEntryRow[];
  /** The global ledger links each entry to its account; an account's own page does not. */
  showAccount?: boolean;
}

/** Journal entries as the ledger reads: what happened, when, and its postings in debit/credit. */
export function JournalEntryList({ entries, showAccount = false }: JournalEntryListProps) {
  return (
    <ol className="flex flex-col">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-col gap-2 border-b border-border py-4 first:pt-0 last:border-b-0"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                {entry.kindKey ? t(entry.kindKey) : entry.kind}
                {entry.description && (
                  <span className="font-normal text-muted"> · {entry.description}</span>
                )}
              </span>
              <span className="flex flex-wrap gap-x-3 text-caption text-muted">
                <time>{entry.createdAt}</time>
                <span className="font-mono" title={entry.id}>
                  {t('journal.entryId', { id: shortId(entry.id) })}
                </span>
                {showAccount && entry.accountId && (
                  <a
                    href={accountHref(entry.accountId)}
                    className="font-mono text-violet underline underline-offset-2"
                    title={entry.accountId}
                  >
                    {t('journal.forAccount', { id: shortId(entry.accountId) })}
                  </a>
                )}
              </span>
            </div>
            <StatusChip
              tone={entry.isBalanced ? 'success' : 'danger'}
              label={entry.isBalanced ? t('journal.balanced') : t('journal.unbalanced')}
            />
          </div>
          <PostingsTable
            caption={t('journal.postingsCaption', { id: shortId(entry.id) })}
            accountHeader={t('journal.accountHeader')}
            debitHeader={t('journal.debit')}
            creditHeader={t('journal.credit')}
            rows={entry.postings.map((posting) => ({
              key: posting.key,
              name: posting.nameKey ? t(posting.nameKey) : null,
              ledgerAccount: posting.ledgerAccount,
              debit: posting.debit,
              credit: posting.credit,
            }))}
          />
        </li>
      ))}
    </ol>
  );
}
