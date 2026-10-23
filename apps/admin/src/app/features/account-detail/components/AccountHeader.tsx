import { StatusChip } from '@acme/ui';
import { shortId } from '@/app/helpers/journal';
import { t } from '@/app/i18n';
import type { AccountHeaderView } from '../hooks/useAccountDetail';

/** Who the account belongs to and where it stands; the page's static h1 sits above it. */
export function AccountHeader({ header }: { header: AccountHeaderView }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-h2 font-bold tracking-tight">{header.name}</h2>
        <StatusChip tone={header.tone} label={header.statusLabel} />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-small text-muted">
        <span className="break-all">{header.email}</span>
        <span className="font-mono" title={header.accountId}>
          {t('accountDetail.accountId', { id: shortId(header.accountId) })}
        </span>
        {header.card && (
          <span className="font-mono">{t('accountDetail.card', { card: header.card })}</span>
        )}
        <span>{t('accountDetail.opened', { date: header.opened })}</span>
        {header.frozen && (
          <span className="font-semibold text-warning">
            {t('accountDetail.frozenBy', { actor: t(header.frozen.byKey) })}
            {header.frozen.reasonKey &&
              ` · ${t('accountDetail.frozenReason', { reason: t(header.frozen.reasonKey) })}`}
          </span>
        )}
        {header.closed && <span>{t('accountDetail.closedOn', { date: header.closed })}</span>}
      </p>
    </div>
  );
}
