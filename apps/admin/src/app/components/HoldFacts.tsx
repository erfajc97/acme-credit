import { AppButton } from '@acme/ui';
import type { HoldView, ReleaseTarget } from '@/app/helpers/holds';
import { t } from '@/app/i18n';

interface HoldFactsProps {
  hold: HoldView;
  release: ReleaseTarget | null;
  onRelease: (target: ReleaseTarget) => void;
}

/**
 * Under a purchase's status: when a live hold expires on its own (in the warning color when it is
 * soon) with "Release hold", or why a released hold was released.
 */
export function HoldFacts({ hold, release, onRelease }: HoldFactsProps) {
  return (
    <>
      {hold.expires && (
        <span
          className={`text-caption ${hold.expiresSoon ? 'font-semibold text-warning' : 'text-muted'}`}
        >
          {t(hold.expiresSoon ? 'holds.expiresSoon' : 'holds.expires', { date: hold.expires })}
        </span>
      )}
      {hold.reversalKey && <span className="text-caption text-muted">{t(hold.reversalKey)}</span>}
      {release && (
        <AppButton
          variant="secondary"
          size="compact"
          onPress={() => onRelease(release)}
          aria-label={t('releaseHold.actionFor', {
            amount: release.amount,
            merchant: release.merchant,
          })}
        >
          {t('releaseHold.action')}
        </AppButton>
      )}
    </>
  );
}
