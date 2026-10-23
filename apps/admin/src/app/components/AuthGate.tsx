import { ButtonLink, ErrorState, InlineNotice, PendingIndicator } from '@acme/ui';
import type { ReactNode } from 'react';
import { useSessionGate } from '@/app/hooks/useSessionGate';
import { t } from '@/app/i18n';
import { localHref, ROUTES } from '@/app/lib/endpoints';

interface AuthGateProps {
  children: ReactNode;
  /**
   * What shows while the session is checked: the page's skeleton. A function, so its copy is
   * translated inside the providers, after the island set the page's locale.
   */
  fallback: () => ReactNode;
}

/** UX gate only: the API authorizes every request whatever the UI shows. */
export function AuthGate({ children, fallback }: AuthGateProps) {
  const gate = useSessionGate();
  if (gate.state === 'ready') return children;
  if (gate.state === 'error') {
    return (
      <ErrorState
        title={t('session.checkFailedTitle')}
        body={t('session.checkFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={gate.retry}
        isRetrying={gate.isRetrying}
      />
    );
  }
  if (gate.state === 'forbidden') {
    return (
      <div className="flex flex-col items-start gap-4">
        <InlineNotice tone="warning" title={t('session.forbiddenTitle')}>
          {t('session.forbiddenBody')}
        </InlineNotice>
        <ButtonLink href={localHref(ROUTES.signIn)} variant="secondary">
          {t('session.signInAsAdmin')}
        </ButtonLink>
      </div>
    );
  }
  if (gate.state === 'redirecting') return <PendingIndicator label={t('session.redirecting')} />;
  return fallback();
}
