import { ButtonLink, EmptyState, ErrorState } from '@acme/ui';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import { useAccountHome } from '../hooks/useAccountHome';
import type { AccountScreenKind } from '../types';
import { AccountOverview } from './AccountOverview';
import { CardScreen } from './CardScreen';
import { ClosedAccount } from './ClosedAccount';
import { OpenAccountCard } from './OpenAccountCard';
import { PendingCollateral } from './PendingCollateral';

interface AccountScreenProps {
  screen: AccountScreenKind;
}

/** One screen per life-cycle state, plus loading and error (W13); the card page needs an open card. */
export function AccountScreen({ screen }: AccountScreenProps) {
  const home = useAccountHome();
  if (home.isLoading)
    return <PageSkeleton label={t(screen === 'card' ? 'card.loading' : 'account.loading')} />;
  if (home.isError || home.view === null) {
    return (
      <ErrorState
        title={t('account.loadFailedTitle')}
        body={t('account.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={home.retry}
        isRetrying={home.isRetrying}
      />
    );
  }
  if (screen === 'card') {
    if (home.view === 'open' && home.account) return <CardScreen account={home.account} />;
    return (
      <EmptyState
        title={t('card.noCardTitle')}
        body={t('card.noCardBody')}
        action={<ButtonLink href={home.walletHref}>{t('common.backToAccount')}</ButtonLink>}
      />
    );
  }
  if (home.view === 'none' || !home.account) return <OpenAccountCard />;
  if (home.view === 'pendingCollateral') return <PendingCollateral accountId={home.account.id} />;
  if (home.view === 'closed') return <ClosedAccount account={home.account} />;
  return <AccountOverview account={home.account} />;
}
